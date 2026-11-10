import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from hardware import select_device


class DeviceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.torch = Mock()

    @patch.dict('os.environ', {'EARIA_IMAGE_DEVICE': 'cpu'})
    def test_forced_cpu_does_not_touch_cuda(self):
        self.assertEqual(select_device(self.torch, self.root)[0], 'cpu')
        self.torch.cuda.is_available.assert_not_called()

    @patch.dict('os.environ', {'EARIA_IMAGE_DEVICE': 'auto'})
    def test_no_gpu_falls_back(self):
        self.torch.cuda.is_available.return_value = False
        self.assertEqual(select_device(self.torch, self.root)[0], 'cpu')

    @patch.dict('os.environ', {'EARIA_IMAGE_DEVICE': 'auto'})
    def test_broken_driver_falls_back(self):
        self.torch.cuda.is_available.return_value = True
        self.torch.ones.side_effect = RuntimeError('driver incompatible')
        self.assertEqual(select_device(self.torch, self.root)[0], 'cpu')

    @patch.dict('os.environ', {'EARIA_IMAGE_DEVICE': 'cuda'})
    def test_explicit_cuda_reports_failure(self):
        self.torch.cuda.is_available.return_value = False
        with self.assertRaisesRegex(RuntimeError, 'CUDA'):
            select_device(self.torch, self.root)

    @patch.dict('os.environ', {'EARIA_IMAGE_DEVICE': 'auto'})
    def test_working_cuda_selected(self):
        self.torch.cuda.is_available.return_value = True
        self.torch.ones.return_value = 1
        self.assertEqual(select_device(self.torch, self.root)[0], 'cuda')
        self.torch.cuda.synchronize.assert_called_once()


if __name__ == '__main__':
    unittest.main()
