import { errors } from '@feathersjs/errors'

export const ERROR = Symbol.for('feathers-kysely/error')

/**
 * Returns the correct Feathers Error depending on the SQL error.
 * @param error
 * @returns a type of FeathersError
 */
export function errorHandler(error: any, params: any) {
  const { message } = error
  console.error(message)

  let feathersError = error

  if (error.sqlState && error.sqlState.length) {
    // remove SQLSTATE marker (#) and pad/truncate SQLSTATE to 5 chars
    const sqlState = `00000${error.sqlState.replace('#', '')}`.slice(-5)

    switch (sqlState.slice(0, 2)) {
      case '02':
        feathersError = new errors.NotFound(message)
        break
      case '28':
        feathersError = new errors.Forbidden(message)
        break
      case '08':
      case '0A':
      case '0K':
        feathersError = new errors.Unavailable(message)
        break
      case '20':
      case '21':
      case '22':
      case '23':
      case '24':
      case '25':
      case '40':
      case '42':
      case '70':
        feathersError = new errors.BadRequest(message)
        break
      default:
        feathersError = new errors.GeneralError(message)
    }
  } else if (error.message.includes('SqliteError') || error.message.includes('D1_TYPE_ERROR')) {
    let message = error.message

    // remove SqliteError marker
    message = message.replace('SqliteError: ', '')

    const errorData = { query: JSON.stringify(params.query) }

    // remove D1_ERROR marker
    if (message.includes('D1_ERROR: ')) message = message.replace('D1_ERROR: ', '')

    if (message.includes('UNIQUE constraint failed:'))
      feathersError = new errors.BadRequest(message, errorData)

    if (message.includes('not supported for value')) feathersError = new errors.BadRequest(message, errorData)
    else feathersError = new errors.GeneralError(message, errorData)
  } else if (typeof error.code === 'string' && error.severity && error.routine) {
    // NOTE: Error codes taken from
    // https://www.postgresql.org/docs/9.6/static/errcodes-appendix.html
    // Omit query information
    const messages = (error.message || '').split('-')

    error.message = messages[messages.length - 1]

    switch (error.code.slice(0, 2)) {
      case '22':
        feathersError = new errors.NotFound(message)
        break
      case '23':
        feathersError = new errors.BadRequest(message)
        break
      case '28':
        feathersError = new errors.Forbidden(message)
        break
      case '3D':
      case '3F':
      case '42':
        feathersError = new errors.Unprocessable(message)
        break
      default:
        feathersError = new errors.GeneralError(message)
        break
    }
  } else if (!(error instanceof errors.FeathersError)) {
    feathersError = new errors.GeneralError(message)
  }

  // feathersError[ERROR] = error

  return feathersError
}
