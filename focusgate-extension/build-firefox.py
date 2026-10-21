#!/usr/bin/env python3
"""Firefox uchun kengaytma: shu papkadan downloads/focusgate-firefox.zip (.xpi) yasaydi.

Farqlar (kod bitta, faqat yig'ishda):
  • background: service_worker o'rniga background.scripts (Firefox MV3)
  • browser_specific_settings.gecko — kengaytma ID va ma'lumot yig'ish deklaratsiyasi
  • har bir skript boshida `chrome` → `browser` (Firefox'da promise qaytaradigan API)
Ishga tushirish:  python3 focusgate-extension/build-firefox.py
"""
import json, os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'downloads', 'focusgate-firefox.zip')
SKIP = {'build-firefox.py', 'README.md'}

SHIM_MODULE = "const chrome = globalThis.browser || globalThis.chrome; // Firefox: promise'li API\n"
SHIM_CLASSIC = "var chrome = (typeof browser !== 'undefined') ? browser : chrome; // Firefox: promise'li API\n"


def manifest():
    m = json.load(open(os.path.join(HERE, 'manifest.json'), encoding='utf-8'))
    m['background'] = {'scripts': ['background.js'], 'type': 'module'}
    m['browser_specific_settings'] = {'gecko': {
        'id': 'focusgate@levelupday.app',
        'strict_min_version': '121.0',
        'data_collection_permissions': {'required': ['browsingActivity']},
    }}
    return json.dumps(m, ensure_ascii=False, indent=2)


def main():
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(HERE):
            for f in sorted(files):
                if f in SKIP or f.startswith('.'):
                    continue
                p = os.path.join(root, f)
                rel = os.path.relpath(p, HERE)
                if rel == 'manifest.json':
                    z.writestr(rel, manifest())
                elif f.endswith('.js'):
                    src = open(p, encoding='utf-8').read()
                    module = f in ('background.js', 'rules.js', 'popup.js')
                    if 'chrome.' in src:
                        src = (SHIM_MODULE if module else SHIM_CLASSIC) + src
                    z.writestr(rel, src)
                else:
                    z.write(p, rel)
    print('OK', os.path.relpath(OUT))


if __name__ == '__main__':
    main()
