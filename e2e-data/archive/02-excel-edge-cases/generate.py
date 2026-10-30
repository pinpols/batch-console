#!/usr/bin/env python3
"""
基于 ta 整包 Excel 派生 3 份异常用例:
  - bad-missing-required-col.xlsx       缺 jobCode 必填列
  - bad-invalid-enum.xlsx               schedule_type 非法值
  - bad-too-large.xlsx                  job_definition 5500 行,超 BE 5000 上限
跑:  python3 generate.py
"""
import os, shutil, openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(
  os.path.dirname(HERE),
  '01-tenant-config-import',
  'ta-tenant-config-package-test.xlsx',
)
SRC = os.path.realpath(SRC)


def derive(name, mutator):
  dst = os.path.join(HERE, name)
  shutil.copyfile(SRC, dst)
  wb = openpyxl.load_workbook(dst)
  mutator(wb)
  wb.save(dst)
  print(f'  generated {name}')


# 1. 缺必填列 — 删 job_definition.job_code 列
def m_missing_col(wb):
  ws = wb['job_definition']
  # 找 job_code 列 idx
  header = [c.value for c in ws[1]]
  idx = header.index('job_code') + 1
  ws.delete_cols(idx)


# 2. 非法 enum — schedule_type 改成 INVALID
def m_invalid_enum(wb):
  ws = wb['job_definition']
  header = [c.value for c in ws[1]]
  col = header.index('schedule_type') + 1
  # 改第 2 行(第一条数据行)
  ws.cell(row=2, column=col, value='INVALID_ENUM_XXX')


# 3. 超大 — job_definition 扩到 5500 行(基于现有数据复制)
def m_too_large(wb):
  ws = wb['job_definition']
  if ws.max_row < 2:
    return
  base_rows = list(ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True))
  target = 5500
  i = ws.max_row + 1
  while i <= target:
    src_row = base_rows[(i - 2) % len(base_rows)]
    # 改 job_code 避免重复:加 idx 后缀
    new_row = list(src_row)
    header = [c.value for c in ws[1]]
    code_idx = header.index('job_code')
    new_row[code_idx] = f'{src_row[code_idx]}_{i}'
    ws.append(new_row)
    i += 1


derive('bad-missing-required-col.xlsx', m_missing_col)
derive('bad-invalid-enum.xlsx', m_invalid_enum)
derive('bad-too-large.xlsx', m_too_large)
print('done.')
