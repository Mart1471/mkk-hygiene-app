#!/usr/bin/env python3
import hashlib, json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE='https://verbraucherfenster.hessen.de/ernaehrung/sichere-lebensmittel/veroeffentlichung-maengel-lfgb'
OUT=Path(__file__).resolve().parents[1]/'data'/'entries.json'
UA='MKK-Hygiene-Monitor/1.0 (public-data monitor; GitHub Pages)'

def norm(s): return re.sub(r'\s+',' ',s or '').strip()
def lines(node): return [norm(x) for x in node.get_text('\n').splitlines() if norm(x)]
def stable_id(url,name,street):
    m=re.search(r'/view/(\d+)/',url)
    return m.group(1) if m else hashlib.sha1(f'{url}|{name}|{street}'.encode()).hexdigest()[:16]

def parse_card(anchor):
    node=anchor
    best=None
    for _ in range(9):
        node=node.parent
        if node is None: break
        ls=lines(node); txt=' | '.join(ls)
        if 'Zuständigkeitsbereich' in ls and re.search(r'\b\d{5}\b',txt):
            best=ls
            if len(ls)<80: break
    if not best: return None
    ls=best
    try:
        i=ls.index('Zuständigkeitsbereich')
        authority=ls[i+1]
    except Exception: return None
    if authority!='Main-Kinzig-Kreis': return None
    try:
        name=ls[i+2]; street=ls[i+3]; cityline=ls[i+4]
    except IndexError: return None
    m=re.match(r'(\d{5})\s+(.+)',cityline)
    postal,city=(m.group(1),m.group(2)) if m else ('',cityline)
    end=len(ls)
    for marker in ('Detailansicht','Zuständigkeitsbereich'):
        for j in range(i+5,len(ls)):
            if ls[j]==marker:
                end=min(end,j);break
    summary='\n'.join(ls[i+5:end])
    summary=re.sub(r'\s+',' ',summary).strip()
    href=urljoin(BASE,anchor.get('href',''))
    detected=''
    dm=re.search(r'(?:Verstoß festgestellt am|Datum der Feststellung:)\s*(\d{2}\.\d{2}\.(?:\d{2}|\d{4}))',summary,re.I)
    if dm: detected=dm.group(1)
    resolved=bool(re.search(r'(Mängel|Beanstandungen).{0,80}(behoben|beseitigt)|Nachkontrolle.{0,100}(behoben|beseitigt)',summary,re.I))
    return {'id':stable_id(href,name,street),'url':href,'name':name,'street':street,'postal_code':postal,'city':city,'authority':authority,'detected_date':detected,'published_date':'','summary':summary,'resolved':resolved}

def load_old():
    try:return {x['id']:x for x in json.loads(OUT.read_text(encoding='utf-8')).get('entries',[])}
    except:return {}

def main():
    s=requests.Session(); s.headers.update({'User-Agent':UA,'Accept-Language':'de-DE,de;q=0.9'})
    found={}; seen_links=set(); empty=0
    for page in range(0,60):
        r=s.get(BASE,params={'displayFirst':'list_first','page':page},timeout=30); r.raise_for_status()
        soup=BeautifulSoup(r.text,'html.parser')
        anchors=[a for a in soup.find_all('a',href=True) if '/maengel/mangel/view/' in a['href']]
        links={urljoin(BASE,a['href']) for a in anchors}
        newlinks=links-seen_links
        if not anchors or (page>0 and not newlinks):
            empty+=1
            if empty>=2: break
        else: empty=0
        seen_links|=links
        for a in anchors:
            x=parse_card(a)
            if x: found[x['id']]=x
        time.sleep(.35)
    if not found:
        print('ERROR: Keine MKK-Einträge erkannt; vorhandene Datei bleibt unverändert.',file=sys.stderr); return 2
    old=load_old(); now=datetime.now(timezone.utc).isoformat(timespec='seconds')
    entries=[]
    for x in found.values():
        prev=old.get(x['id'],{})
        x['first_seen']=prev.get('first_seen',now)
        x['last_seen']=now
        entries.append(x)
    entries.sort(key=lambda x:(x.get('first_seen',''),x.get('name','')),reverse=True)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'generated_at':now,'source':BASE,'authority':'Main-Kinzig-Kreis','entries':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{len(entries)} MKK-Einträge gespeichert.')
    return 0
if __name__=='__main__': raise SystemExit(main())
