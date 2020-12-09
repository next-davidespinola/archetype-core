const glob = require('glob')
const fs = require('fs-extra')
const path = require('path')
const ejs = require('ejs')
const pickBy = require('lodash.pickby')
const { prompt } = require('inquirer')
const { program } = require('commander')
const { paramCase, snakeCase, pascalCase } = require('change-case')
const { ejsOptions, inquirerTypesToCommanderValues } = require('./config')

const splitCommaParam = val => (val.length ? val.split(',') : [])

async function readQuestions(inquirerQuestions) {
  let configFile = {}
  const questionTypes = new Map()

  // Add hardcoded config option for config file path
  program.option('--config [filePath]', 'File with options to process')

  inquirerQuestions.forEach(question => {
    // Create commander options for each inquirer question
    const param = `--${paramCase(question.name)}`
    const valueExpression = inquirerTypesToCommanderValues[question.type] || ' [string]'
    const customProcessing = question.type === 'checkbox' ? splitCommaParam : undefined
    program.option(param + valueExpression, question.message, customProcessing)

    // Populate questionTypes for better commander parsing
    questionTypes.set(question.name, question.type)
  })

  // Read comand line param options
  const { config: configFilePath, ...paramsConfig } = program.parse(process.argv)

  // Get config file
  if (configFilePath) configFile = await fs.readJSON(configFilePath)

  // Merge config file with clean comand line params (commander return a lot of internal keys)
  const cliOptions = {
    ...configFile,
    ...pickBy(paramsConfig, (value, key) => {
      if (!questionTypes.has(key)) return false
      if (questionTypes.get(key) !== 'confirm' && typeof value === 'boolean') return false
      return true
    })
  }

  // Read user response only on those questions that need response
  const userResponse = await prompt(
    inquirerQuestions.map(question => {
      const when = question.when || (() => true)
      return {
        ...question,
        when: answers => cliOptions[question.name] === undefined && when({ ...cliOptions, ...answers })
      }
    })
  )

  const optionValues = { ...cliOptions, ...userResponse }

  // Generate string variants for template interpolation
  const additionalStrings = Array.from(questionTypes.entries()).reduce((obj, [name, type]) => {
    if (type === 'number' || type === 'confirm') return obj

    const value = optionValues[name]
    if (!value) return

    const isArray = Array.isArray(value)
    return {
      ...obj,
      [name + '_snake']: isArray ? value.map(snakeCase) : snakeCase(value),
      [name + '_pascal']: isArray ? value.map(pascalCase) : pascalCase(value),
      [name + '_param']: isArray ? value.map(paramCase) : paramCase(value)
    }
  }, {})

  return { ...optionValues, ...additionalStrings }
}

async function runTemplateEngine(templateData) {
  const templateRelativePaths = glob.sync('**/*.*', { cwd: path.join(__dirname, 'template'), dot: true })

  const writingOperations = templateRelativePaths.map(async templateRelativePath => {
    const templateAbsolutePath = path.join(__dirname, 'template', templateRelativePath)

    const templateContent = await fs.readFile(templateAbsolutePath, 'utf-8')
    const renderedContent = ejs.render(templateContent, templateData, ejsOptions)
    const renderedFileName = ejs.render(templateRelativePath, templateData, ejsOptions)

    const destinationPath = path.join(process.cwd(), renderedFileName)
    await fs.outputFile(destinationPath, renderedContent)
    console.log('- ' + renderedFileName)
  })

  console.log('Added files:')
  return await Promise.all(writingOperations)
}

module.exports = { runTemplateEngine, readQuestions }
