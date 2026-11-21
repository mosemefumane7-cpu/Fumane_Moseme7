function write(level, message, error) {
  const entry = { time: new Date().toISOString(), level, message };
  if (error) entry.error = { name: error.name, code: error.code, message: error.message };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else console.log(output);
}

module.exports = { logger: { info: (message) => write('info', message), error: (message, error) => write('error', message, error) } };
