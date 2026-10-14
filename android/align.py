# zipalign o'rniga: siqilmagan (STORED) fayllar ma'lumoti 4 baytga tekislanadi (Android 11+ resources.arsc uchun shart).
# Foydalanish: python3 align.py kirish.apk chiqish.apk   |   python3 align.py --check imzolangan.apk
import struct, sys, zipfile

def offsets(path):
    z = zipfile.ZipFile(path)
    with open(path, 'rb') as f:
        for i in z.infolist():
            f.seek(i.header_offset); h = f.read(30)
            n, e = struct.unpack('<HH', h[26:30])
            yield i, i.header_offset + 30 + n + e

if sys.argv[1] == '--check':
    bad = [i.filename for i, off in offsets(sys.argv[2]) if i.compress_type == zipfile.ZIP_STORED and off % 4]
    if bad: print('tekislanmagan:', bad); sys.exit(1)
    print('aligned ok'); sys.exit(0)

src = zipfile.ZipFile(sys.argv[1])
with open(sys.argv[2], 'wb') as raw, zipfile.ZipFile(raw, 'w') as out:
    for i in src.infolist():
        data = src.read(i)
        zi = zipfile.ZipInfo(i.filename, date_time=(2020, 1, 1, 0, 0, 0))
        zi.compress_type = i.compress_type
        zi.external_attr = i.external_attr
        if i.compress_type == zipfile.ZIP_STORED:
            base = raw.tell() + 30 + len(i.filename.encode())
            zi.extra = b'\0' * ((4 - base % 4) % 4)
        out.writestr(zi, data)
