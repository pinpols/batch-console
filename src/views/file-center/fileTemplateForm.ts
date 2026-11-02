export function createFileTemplateForm() {
  return {
    templateCode: '',
    templateName: '',
    templateType: 'IMPORT',
    bizType: '',
    fileFormatType: 'DELIMITED',
    charset: 'UTF-8',
    targetCharset: 'UTF-8',
    withBom: false,
    delimiter: ',',
    lineSeparator: '\\n',
    fieldMappingsJson: '',
    queryParamSchemaJson: '',
    defaultQuerySql: '',
    enabled: true,
    version: 1,
    description: '',
  }
}
