
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello World');
});
server.listen(5001, () => {
  console.log('Test server running on 5001');
});
setTimeout(() => {
  console.log('Still alive...');
}, 10000);
