# Earia 05 – letöltés és indítás

[English version](README.md)

A továbbadható program az **earia** mappa. Az egész mappát töltsd le/csomagold ki, ne csak az indítófájlt. A README egy példánya a programban is megtalálható.

GitHubról: **Code → Download ZIP**, majd a ZIP teljes tartalmát csomagold ki egy írható mappába. Az `INDITAS.cmd` a kicsomagolt program gyökerében található.

## Milyen gépen fut?

- **Windows 10/11, x64**, írható mappa, például `C:\Games\earia`. ZIP-ből közvetlenül ne indítsd.
- NVIDIA: automatikus CUDA-gyorsítás, ha a kártya és az illesztőprogram támogatja a mellékelt PyTorch-változatot. Friss NVIDIA-driver ajánlott.
- AMD, Intel vagy külön videokártya nélkül: **CPU-s képgenerálás**. Nem igényel NVIDIA-t, de egy kép percekig vagy tovább is készülhet. Ez a kiadás nem használ AMD/Intel GPU-gyorsítást.
- A csomag nem macOS/Linux/Windows ARM kiadás. Az „univerzális” itt a Windows x64 gépeken elérhető CPU-s tartalék módot jelenti, nem minden operációs rendszer támogatását.
- SD1.5-höz 16 GB RAM ajánlott kiindulás; CPU-s, referenciás vagy Pony/SDXL használathoz inkább 32 GB. A tényleges memóriaigény a modelltől és képmérettől függ; ez nem minden gépen mért minimum.
- Legyen legalább 20 GB szabad hely; Ponyval és CUDA-val inkább 35 GB. A telepítő letöltési gyorsítótára is foglal helyet.

## Első indítás

1. Indítsd el az `earia\INDITAS.cmd` fájlt.
2. Az első indítás felajánlja a képmotor telepítését. **I** = letöltés és telepítés a program saját mappájába; **N** = a játék képmotor nélkül indul. Később a `KEP_MOTOR_TELEPITES.cmd` indítható.
3. A telepítő saját Pythont, PyTorchot, Diffuserst, az SD1.5 alapmodellt és a karakterreferenciákhoz szükséges IP-Adapter modult telepíti. A letöltés több GB; internet szükséges. A parancsablakban látszik a folyamat és az esetleges hiba. Megszakadt telepítés után újra futtatható.
4. A megnyíló játék Beállítások részében válaszd az API-t, add meg a saját szolgáltatódat, modellazonosítódat és API-kulcsodat. A mintában DeepSeek szerepel; a fiókodban elérhető modell nevét add meg. A beszélgetés az API-szolgáltatóhoz kerül, az API-használat díját te fizeted.
5. Hozz létre új játékot. A képgenerálásnál a telepített képmodellek közül választhatsz.

**Nem kell külön Node.js, Python, Git, ComfyUI, CUDA Toolkit, FFmpeg vagy kodekcsomag.** A Node benne van a letöltésben, a képfüggőségeket a telepítő intézi. Böngésző és a Windows PowerShell szükséges. Rendszergazdai telepítés alaphelyzetben nem kell.

Ha Windows hiányzó `VCRUNTIME`/`MSVCP` DLL-t vagy PyTorch DLL-betöltési hibát jelez, telepítsd/javítsd a [Microsoft Visual C++ x64 Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe) csomagot. Ez rendszerszintű összetevő, rendszergazdai jóváhagyást kérhet; a játék nem telepíti észrevétlenül. Drivertelepítést sem végez.

## YiffyMix – mit kell hová másolni?

A YiffyMix nincs a csomagban, és a telepítő nem tölti le automatikusan.

1. Szerezd be a használni kívánt **SD1.5-alapú YiffyMix checkpointot** a modell szerzőjének/terjesztőjének oldaláról, a hozzá tartozó feltételekkel.
2. A `.safetensors` fájlt másold ide és nevezd át pontosan erre:

   `earia\image-gen\models\yiffymix\yiffymix.safetensors`

3. Futtasd a képmotor telepítőjét is: a checkpoint mellé szükséges az SD1.5 konfiguráció és tokenizer. Pusztán a fájl átnevezése nem tesz egy tetszőleges modellt kompatibilissé.

A korábbi helyi példányhoz nem volt hiteles verzió-/forrásleírás, ezért itt nincs találomra megadott YiffyMix-letöltési link vagy garantált verziószám. Más architektúrájú modellt ne másolj erre a névre.

Az alap **Stable Diffusion 1.5** YiffyMix nélkül is használható. Opcionális Pony telepítés parancsablakból, az earia mappában:

```bat
KEP_MOTOR_TELEPITES.cmd -Models pony
```

Ez az alap- és referenciamodulok mellé letölti a Pony V6 XL checkpointot, SDXL konfigurációját és referenciamodulját is. Jelentősen több tárhely és memória kell hozzá.

## Eszközválasztás és hibakeresés

Automatikus választás az alapértelmezés. Ha NVIDIA-val gond van, vagy biztosan CPU-t szeretnél:

```bat
KEP_MOTOR_TELEPITES.cmd -Device cpu
```

CUDA újratelepítése/engedélyezése:

```bat
KEP_MOTOR_TELEPITES.cmd -Device cuda
```

A mód a `image-gen\device.json` fájlban is állítható: `auto`, `cpu`, `cuda`. `auto` alatt egy sikertelen CUDA-próba CPU-ra vált. Ez nem jelent automatikus CPU-újrapróbálkozást minden későbbi memóriahiba után. Memóriahibánál csökkentsd a képméretet, használj SD1.5 modellt vagy válassz CPU-t. A kényszerített `cuda` hibát jelez, ha nem működik.

Részletek: `logs\app-error.log`, `logs\image-engine.log`, `logs\setup-images.log`. Letöltési hibánál a telepítőablak üzenetét is másold ki. Az alkalmazás címe `http://127.0.0.1:43141`; a 04-es kiadástól eltérő portot használ. Kilépéshez a játék Kilépés gombját használd.

## Mappák és adatvédelem

| Útvonal az earia mappán belül | Tartalom |
|---|---|
| `runtime\node.exe` | A program mellékelt futtatókörnyezete |
| `image-gen\runtime` | A telepítő saját Pythonja és képfüggőségei |
| `image-gen\models\sd15` | Automatikusan letöltött SD1.5 |
| `image-gen\models\yiffymix` | A kézzel bemásolt checkpoint |
| `image-gen\models\ip-adapter` | Karakterreferencia-modul |
| `image-gen\models\pony-v6-xl` | Opcionális Pony checkpoint és konfiguráció |
| `image-gen\references\styles` | Saját globális stílusreferenciák; üresen is működik |
| `saves` | Saját játékok, karakteradatok, avatárok, referenciák és számozott képek |
| `config.json` | Saját beállítások és titkosított API-kulcs; első indításkor jön létre |

A kiadás nem tartalmaz személyes mentést, kulcsot, referencia-képregényt vagy több GB-os modellt. A képek helyben készülnek; a telepítő csak függőségeket tölt le. Az API-kulcs Windows-felhasználóhoz kötötten titkosított: másik gépen/felhasználónál újra meg kell adni.

Ha használat után újra továbbadod, **ne küldd tovább** a `config.json`, `saves`, `logs`, saját referenciák és letöltési gyorsítótár tartalmát. Az eredeti, tiszta csomagot add tovább. A `models` gyökérmappa és a helyi beszédmodellhez kapcsolódó régi kód kompatibilitási okból megmaradt, de beszédmodell és llama futtatókörnyezet nincs mellékelve: ez a kiadás API-s játékra van előkészítve.

## Fejlesztőknek

```bat
runtime\node.exe --test tests/*.test.mjs
image-gen\runtime\python.exe image-gen\test_hardware.py
```

Rögzített modellforrások/revíziók: `image-gen\install-models.py`. Futás közben a képmodellek betöltése offline történik. A telepítő nem módosítja a rendszer Pythonját. A 04-esből átvett játékszabályok/narrátorprompt tartalmát ez a csomagolás nem írta át. A karakterek összemosódását és a stílusbefolyásolás minőségét ez a kiadás nem oldja meg; most a továbbadható telepítés és a hardverfüggés volt a feladat.

Külső összetevők: [Python](https://www.python.org/downloads/release/python-31312/), [PyTorch](https://pytorch.org/get-started/locally/), [Diffusers](https://huggingface.co/docs/diffusers/), [SD1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5), [IP-Adapter](https://huggingface.co/h94/IP-Adapter), [Pony](https://huggingface.co/Runware/Pony_Diffusion_V6_XL). Mindegyik saját licenccel rendelkezik; ezek nem helyettesítik az Earia forráskódjának szerző által választandó licencét.

## Kapcsolat és visszajelzés

Javaslatokat, hibajelentéseket, hibajavításokat és véleményeket örömmel várok a **[clawdraw69@gmail.com](mailto:clawdraw69@gmail.com)** e-mail-címre.

## Az angol fordítás állapota

Az alapértelmezett felület angol; a nyelvválasztóban a magyar is elérhető. A fordítás előzetes változat: az indítóprogram és a képmotor egyes üzenetei még magyarok, a teljes angol felület ellenőrzése hátravan. A meglévő automatizált tesztek mindegyike sikeres (70/70); ez nem teljes angol végponttól végpontig tartó ellenőrzés.

Játékdokumentumok: [angol DOCX](docs/Earia%202.0.en.docx) · [eredeti magyar DOCX](docs/Earia%202.0.hu.docx). Az angol dokumentum vizuális ellenőrzése még hátravan. Ezek korábbi forrásdokumentumok; egyes szabályaik eltérnek a jelenlegi megvalósítástól. Az eredeti magyar narrátorprompt az angol fordítás mellett változatlanul megmaradt.
