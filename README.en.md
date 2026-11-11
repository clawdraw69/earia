# Earia 05 – download and setup

[Magyar változat](README.hu.md)

The distributable application is the **earia** folder. Download and extract the entire folder, not just the launcher. A copy of the README is included with the application.

On GitHub, choose **Code → Download ZIP**, then extract the entire archive into a writable folder. You will find `INDITAS.cmd` in the extracted application's root folder.

## Supported systems

- **Windows 10/11, x64**, with a writable installation folder such as `C:\Games\earia`. Do not launch directly from the ZIP archive.
- NVIDIA: automatic CUDA acceleration when the GPU and driver support the installed PyTorch version. An up-to-date NVIDIA driver is recommended.
- AMD, Intel, or no dedicated GPU: **CPU image generation**. NVIDIA hardware is not required, but generating one image may take several minutes or longer. This release does not provide AMD/Intel GPU acceleration.
- This is not a macOS, Linux, or Windows ARM release. “Universal” here means a CPU fallback on Windows x64, not support for every operating system.
- For SD1.5, 16 GB RAM is a recommended starting point; 32 GB is preferable for CPU generation, character references, or Pony/SDXL. Actual memory usage depends on the model and image size; these are recommendations, not minimums verified on every machine.
- Allow at least 20 GB of free storage, preferably 35 GB with Pony and CUDA. The installer's download cache also takes up space.

## First launch

1. Run `INDITAS.cmd` inside the application folder.
2. On first launch, you can install the image engine. At the Hungarian prompt, **I** means download and install into the application's own folder; **N** starts the game without the image engine. You can run `KEP_MOTOR_TELEPITES.cmd` later.
3. The installer downloads its own Python, PyTorch, Diffusers, the SD1.5 base model, and IP-Adapter for character references. Downloads total several GB and require internet access. Progress and errors appear in the command window. You can rerun the installer after an interrupted installation.
4. In the game's settings (**Beállítások**), select API mode and enter your provider, model identifier, and API key. The example configuration uses DeepSeek; enter a model name available to your account. Conversations are sent to your API provider, and you are responsible for API usage charges.
5. Create a new game. In the image generation panel, choose from the installed image models.

**You do not need to install Node.js, Python, Git, ComfyUI, CUDA Toolkit, FFmpeg, or a codec pack separately.** Node is bundled, and the installer handles image generation dependencies. A web browser and Windows PowerShell are required. Administrator privileges are not normally needed.

If Windows reports a missing `VCRUNTIME`/`MSVCP` DLL or a PyTorch DLL loading error, install or repair the [Microsoft Visual C++ x64 Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe). This system component may require administrator approval; the game does not install it silently. It does not install GPU drivers either.

## YiffyMix – where to put the model

YiffyMix is not included and is not downloaded automatically.

1. Obtain the **SD1.5-based YiffyMix checkpoint** you want to use from its author or distributor, subject to its terms.
2. Copy the `.safetensors` file to this location inside the application folder and give it this exact name:

   `image-gen\models\yiffymix\yiffymix.safetensors`

3. Also run the image engine installer: the checkpoint needs the SD1.5 configuration and tokenizer. Renaming an arbitrary model does not make it compatible.

The previous local copy had no verified version or source information, so no guessed download link or guaranteed YiffyMix version is listed here. Do not put a model with a different architecture under this filename.

The base **Stable Diffusion 1.5** model works without YiffyMix. To optionally install Pony, run this command from the application folder:

```bat
KEP_MOTOR_TELEPITES.cmd -Models pony
```

Alongside the base and reference components, this downloads the Pony V6 XL checkpoint, its SDXL configuration, and its reference adapter. It requires considerably more storage and memory.

## Device selection and troubleshooting

Automatic selection is the default. If NVIDIA acceleration causes problems, or you want to use the CPU explicitly:

```bat
KEP_MOTOR_TELEPITES.cmd -Device cpu
```

To install or enable CUDA support:

```bat
KEP_MOTOR_TELEPITES.cmd -Device cuda
```

You can also set the mode in `image-gen\device.json`: `auto`, `cpu`, or `cuda`. In `auto` mode, a failed CUDA startup probe falls back to the CPU. This does not mean every subsequent out-of-memory error will automatically retry on the CPU. For memory errors, reduce the image size, use an SD1.5 model, or select CPU mode. Explicit `cuda` mode reports an error if CUDA is unavailable.

Logs: `logs\app-error.log`, `logs\image-engine.log`, and `logs\setup-images.log`. For download problems, also copy the message shown in the installer window. The application runs at `http://127.0.0.1:43141`, on a different port from release 04. Use the game's **Kilépés** (Exit) button to shut down.

## Folders and privacy

| Path inside the application folder | Contents |
|---|---|
| `runtime\node.exe` | Bundled application runtime |
| `image-gen\runtime` | The installer's own Python and image generation dependencies |
| `image-gen\models\sd15` | Automatically downloaded SD1.5 model |
| `image-gen\models\yiffymix` | Manually supplied checkpoint |
| `image-gen\models\ip-adapter` | Character reference adapter |
| `image-gen\models\pony-v6-xl` | Optional Pony checkpoint and configuration |
| `image-gen\references\styles` | Your global style references; may be left empty |
| `saves` | Your games, character data, avatars, references, and numbered images |
| `config.json` | Your settings and encrypted API key; created on first launch |

The release contains no personal saves, keys, reference comics, or multi-GB models. Images are generated locally; the installer only downloads dependencies. API keys are encrypted for the current Windows user and must be entered again on another computer or under another user account.

If you redistribute the application after using it, **do not include** your `config.json`, `saves`, `logs`, personal references, or download cache. Share the original clean package instead. The top-level `models` folder and legacy local language-model code remain for compatibility, but no language model or llama runtime is bundled: this release is prepared for API-based gameplay.

## For developers

```bat
runtime\node.exe --test tests/*.test.mjs
image-gen\runtime\python.exe image-gen\test_hardware.py
```

Pinned model sources and revisions are in `image-gen\install-models.py`. Image models load offline during generation. The installer does not modify the system Python installation. Packaging this release did not change the game rules or narrator prompt inherited from version 04. This release does not resolve character blending or style influence quality issues; its focus is distributable installation and hardware compatibility.

Third-party components: [Python](https://www.python.org/downloads/release/python-31312/), [PyTorch](https://pytorch.org/get-started/locally/), [Diffusers](https://huggingface.co/docs/diffusers/), [SD1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5), [IP-Adapter](https://huggingface.co/h94/IP-Adapter), and [Pony](https://huggingface.co/Runware/Pony_Diffusion_V6_XL). Each has its own license; these do not replace a license to be chosen by the author for Earia's source code.

## Contact and feedback

Suggestions, bug reports, bug fixes, and feedback are welcome at **[clawdraw69@gmail.com](mailto:clawdraw69@gmail.com)**.

## English localization status

English is the default interface language; Hungarian remains available in the language selector. This localization is a preview: launcher and image-engine messages still include Hungarian, and a complete English UI review is pending. The existing automated suite passes all 70 tests; this is not complete English end-to-end coverage.

Game reference documents: [English DOCX](docs/Earia%202.0.en.docx) · [Original Hungarian DOCX](docs/Earia%202.0.hu.docx). The English document still needs visual layout verification. These are historical source documents; some rules differ from the current implementation. The original Hungarian narrator prompt is preserved alongside its English translation.
