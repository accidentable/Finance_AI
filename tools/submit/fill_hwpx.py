# 한글 양식(hwpx)의 파란 안내 문단을 우리 내용으로 바꿔 새 hwpx를 만든다.
import copy, random, re, sys, zipfile
from xml.etree import ElementTree as ET

HP_NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph'
HP = '{%s}' % HP_NS
NS = {'hp': HP_NS}

def register_namespaces(raw: str):
    for prefix, uri in re.findall(r'xmlns:([A-Za-z0-9]+)="([^"]+)"', raw[:4000]):
        ET.register_namespace(prefix, uri)

def new_id():
    return str(random.randint(10**8, 2**31 - 1))

def make_para(template_p, text, char_pr, para_pr='0'):
    p = copy.deepcopy(template_p)
    p.set('id', new_id())
    p.set('paraPrIDRef', para_pr)
    for child in list(p):
        if child.tag in (HP + 'run', HP + 'linesegarray'):
            p.remove(child)
    run = ET.SubElement(p, HP + 'run')
    run.set('charPrIDRef', char_pr)
    t = ET.SubElement(run, HP + 't')
    t.text = text
    return p

def fill(template_path, out_path, spec):
    z = zipfile.ZipFile(template_path)
    raw = z.read('Contents/section0.xml').decode('utf-8')
    register_namespaces(raw)
    root = ET.fromstring(raw)
    tables = list(root.iter(HP + 'tbl'))
    tbl = tables[1]
    rows = tbl.findall('hp:tr', NS)

    def cell(r, c):
        return rows[r].findall('hp:tc', NS)[c]

    def replace_cell(tc, paragraphs):
        sub = tc.find('hp:subList', NS)
        container = sub if sub is not None else tc
        old = container.findall('hp:p', NS)
        template_p = old[0]
        for p in old:
            container.remove(p)
        for text, style in paragraphs:
            char_pr = spec['styles'][style]
            container.append(make_para(template_p, text, char_pr, spec['para_pr'].get(style, '0')))

    # 팀명 / 구성원
    replace_cell(cell(0, 1), [(spec['team'], 'team')])
    replace_cell(cell(1, 1), [(spec['members'], 'team')])
    # 제목 교체 (자유 항목 등)
    for r, title in spec.get('headings', {}).items():
        tc = cell(r, 0)
        sub = tc.find('hp:subList', NS)
        container = sub if sub is not None else tc
        p = container.findall('hp:p', NS)[0]
        runs = p.findall('hp:run', NS)
        first = runs[0]
        for extra in runs[1:]:
            p.remove(extra)
        for child in list(first):
            first.remove(child)
        t = ET.SubElement(first, HP + 't'); t.text = title
    # 본문
    for r, paragraphs in spec['content'].items():
        replace_cell(cell(r, 0), paragraphs)

    xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + ET.tostring(root, encoding='unicode')
    with zipfile.ZipFile(out_path, 'w') as out:
        names = z.namelist()
        # mimetype는 압축 없이 첫 항목으로
        if 'mimetype' in names:
            out.writestr(zipfile.ZipInfo('mimetype'), z.read('mimetype'), compress_type=zipfile.ZIP_STORED)
        for n in names:
            if n == 'mimetype':
                continue
            data = xml.encode('utf-8') if n == 'Contents/section0.xml' else z.read(n)
            out.writestr(n, data, compress_type=zipfile.ZIP_DEFLATED)
    print('written', out_path)

if __name__ == '__main__':
    import importlib.util, json
    spec_path = sys.argv[3]
    spec_mod = importlib.util.spec_from_file_location('spec', spec_path)
    m = importlib.util.module_from_spec(spec_mod); spec_mod.loader.exec_module(m)
    fill(sys.argv[1], sys.argv[2], m.SPEC)
