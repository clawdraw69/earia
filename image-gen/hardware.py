"""Device selection is independent of model and prompt content."""
import json
import os


def select_device(torch, root):
    mode = os.environ.get('EARIA_IMAGE_DEVICE')
    if not mode:
        file = root / 'device.json'
        mode = json.loads(file.read_text(encoding='utf-8-sig')).get('device', 'auto') if file.exists() else 'auto'
    if mode not in ('auto', 'cpu', 'cuda'):
        raise ValueError('device.json: a device értéke auto, cpu vagy cuda lehet.')
    if mode != 'cpu':
        try:
            if not torch.cuda.is_available():
                raise RuntimeError('CUDA nem érhető el')
            # Availability alone does not prove that the driver supports this wheel.
            probe = torch.ones(1, device='cuda') + 1
            torch.cuda.synchronize()
            del probe
            return 'cuda', 'NVIDIA CUDA képgenerálás.'
        except Exception as exc:
            if mode == 'cuda':
                raise RuntimeError('A kért CUDA mód nem működik. Válassz auto vagy cpu módot. ' + str(exc)) from exc
    return 'cpu', 'CPU-s képgenerálás: NVIDIA nélkül is működik, de lassabb lehet.'
