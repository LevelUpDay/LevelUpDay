#!/usr/bin/env bash
# LevelUpDay Android ilovasini (APK) Android Studio'siz yig'ish: javac → dx → aapt2 → apksig.
# Asboblar (bir marta yuklab olinadi, ./.tools ga):
#   • android.jar o'rniga Robolectric android-all (Maven Central) — framework klasslari + resources.arsc
#   • dalvik-dx (Maven Central), apksig (Maven Central), aapt2 (PyPI "aapt2" paketidagi Linux binar)
# Imzo kaliti: $FG_KEYSTORE (bo'lmasa ./.tools/release.jks). Kalit repoga qo'yilmaydi.
set -euo pipefail
cd "$(dirname "$0")"
T=.tools; mkdir -p "$T"
M=https://repo.maven.apache.org/maven2
[ -f $T/android.jar ] || curl -sSLo $T/android.jar $M/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar
[ -f $T/dx.jar ] || curl -sSLo $T/dx.jar $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
[ -f $T/apksig.jar ] || curl -sSLo $T/apksig.jar $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar
if [ ! -x $T/aapt2 ]; then
  pip download -q aapt2==0.2.1 --no-deps -d $T/whl
  (cd $T/whl && unzip -qo aapt2-0.2.1-py3-none-any.whl 'aapt2/bin/Linux/aapt2')
  cp $T/whl/aapt2/bin/Linux/aapt2 $T/aapt2 && chmod +x $T/aapt2
fi
KS=${FG_KEYSTORE:-$T/release.jks}
[ -f "$KS" ] || { echo "Imzo kaliti yo'q: $KS"; exit 1; }

B=build; rm -rf $B; mkdir -p $B/classes $B/res $B/apk
# 1) Resurslar
$T/aapt2 compile --dir res -o $B/res.zip
$T/aapt2 link -I $T/android.jar --manifest AndroidManifest.xml -o $B/base.apk --java $B/gen \
  --min-sdk-version 24 --target-sdk-version 34 $B/res.zip --auto-add-overlay
# 2) Java → class (Java 8 bayt-kod, lambda'siz) → dex
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -cp $T/android.jar -d $B/classes \
  $(find src $B/gen -name '*.java')
java -cp $T/dx.jar com.android.dx.command.Main --dex --min-sdk-version=24 --output=$B/apk/classes.dex $B/classes
# 3) APK = resurslar + classes.dex, keyin imzo (v1+v2+v3)
cp $B/base.apk $B/unsigned.apk
(cd $B/apk && zip -q -X ../unsigned.apk classes.dex)
python3 align.py $B/unsigned.apk $B/aligned.apk
javac -nowarn -d $B/signer -cp $T/apksig.jar Sign.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp $T/apksig.jar:$B/signer Sign "$KS" "${FG_KS_PASS:-levelupday}" $B/aligned.apk $B/LevelUpDay.apk
python3 align.py --check $B/LevelUpDay.apk
ls -la $B/LevelUpDay.apk
