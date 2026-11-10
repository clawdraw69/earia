# Earia 05 – ellenőrzés, 2026-11-10

- A 04-es forrás alapján készült tiszta kiadás; az eredeti forrás ellenőrzőösszegei a munka végén változatlanok. Az 01–03 mappákhoz nem nyúltunk.
- A narrátor, játékszabályok, karakter- és jelenetpromptok átvett tartalma nem változott. Módosítások: telepítő, indítás, 05-ös verzió/port, API-alapértelmezés, helyi Python kiválasztása, CPU/CUDA eszközválasztás, YiffyMix függőség-felismerés, dokumentáció és tesztek.
- Node tesztek: **70/70 sikeres**. A helyi HTTP-integrációs tesztek hálózati sandboxon kívül futottak; a sandbox elsőre blokkolta a localhost-kapcsolatokat.
- Eszközválasztási tesztek: **5/5 sikeres** (CPU, CUDA, hiányzó/hibás CUDA és automatikus visszaváltás).
- Tiszta külön könyvtárba valóban letöltött, ellenőrzött Python 3.13.12, pip és CPU PyTorch 2.11.0 + torchvision 0.26.0, majd a rögzített képfüggőségek telepítve. A telepítő újrafuttatása sikeres; `pip check`: nincs hibás függőség.
- Valódi SD1.5 képgenerálás: **CPU és CUDA alatt is sikeres**, 512×512, 10 lépés, tájképes teszt. CPU-próba az új, kizárólag CPU-s PyTorch-telepítéssel, CUDA-próba a meglévő CUDA-függőségekkel és az új workerrel. A PNG-k érvényessége és nem üres képtartalma ellenőrizve.
- A nagy modellfájlokat a próbához a meglévő helyi modellekből, csak olvasással használtuk; nem másoltuk a kiadásba. A letöltő négy rögzített Hugging Face repo/revíziója online ellenőrizve. Az összes több GB-os modell tiszta újraletöltését nem ismételtük meg.
- AMD/Intel GPU-gyorsítás nincs ebben a kiadásban; ilyen gépeken a CPU-s útvonal használható. Külön AMD/Intel gépen, macOS/Linux/ARM alatt nem teszteltük. Tiszta CUDA-csomagtelepítést ezen a körön nem ismételtünk meg.
- Nem használtunk fizetős API-kreditet. A kiadásban nincs API-kulcs, személyes mentés, napló vagy referencia-képanyag.
- A modell képi minősége, a karakterek összemosódása és a stílusreferenciák működésének továbbfejlesztése nem része ennek a hordozhatósági módosításnak.

A csomag Windows x64 kiadás; nem állítjuk, hogy minden operációs rendszeren vagy tetszőleges régi hardveren változtatás nélkül fut.
