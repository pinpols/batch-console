"""检查前端租户样本的工作簿契约和配对后端来源，不访问服务或数据库。"""
from pathlib import Path
import hashlib
import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile

FIXTURE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = FIXTURE_DIR.parents[2] / 'file-batch-system' / 'test-data' / 'tenant-config-packages'
FIXTURE_NAMES = tuple(f'{tenant}-tenant-config-package-test.xlsx' for tenant in ('ta', 'tb', 'tc'))
EXPECTED_SHEETS = (
    'resource_queue', 'business_calendar', 'batch_window', 'job_definition',
    'job_monitoring_policy', 'file_channel_config', 'file_template_config',
    'workflow_definition', 'workflow_node', 'workflow_edge',
)
MAIN_NS = {'xlsx': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TenantPackageFixtureContractTest(unittest.TestCase):
    def test_current_sheet_contract(self):
        for name in FIXTURE_NAMES:
            with self.subTest(name=name), ZipFile(FIXTURE_DIR / name) as archive:
                workbook = ET.fromstring(archive.read('xl/workbook.xml'))
                sheets = tuple(sheet.attrib['name'] for sheet in workbook.findall('xlsx:sheets/xlsx:sheet', MAIN_NS))
                self.assertEqual(sheets, EXPECTED_SHEETS)

    @unittest.skipUnless(BACKEND_DIR.is_dir(), '未提供配对后端仓库，无法核对来源文件')
    def test_same_bytes_as_backend_fixtures(self):
        for name in FIXTURE_NAMES:
            with self.subTest(name=name):
                self.assertEqual(sha256(FIXTURE_DIR / name), sha256(BACKEND_DIR / name))


if __name__ == '__main__':
    unittest.main()
