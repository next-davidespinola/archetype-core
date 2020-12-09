const ejsOptions = {
  delimiter: '#',
  openDelimiter: '{',
  closeDelimiter: '}'
}

const inquirerTypesToCommanderValues = {
  confirm: '',
  input: ' [string]',
  password: ' [string]',
  editor: ' [string]',
  rawlist: ' [string]',
  list: ' [string]',
  expand: ' [string]',
  number: ' [number]',
  checkbox: ' [comma separated list]'
}

module.exports = { ejsOptions, inquirerTypesToCommanderValues }
