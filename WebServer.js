const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const port = 8989;

http.createServer(function (request, response) {
    var uri = url.parse(request.url).pathname;
    var filename = path.join(process.cwd(), uri);

    fs.exists(filename, function (exists) {
        if (!exists) {
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.write("404 Not Found\n");
            response.end();
            console.log(request.connection.remoteAddress.toString() + " tried accessing: " + filename + " with response: " + response.statusCode);
            Log2File(request.connection.remoteAddress.toString() + " tried accessing: " + filename + " with response: " + response.statusCode + "\n\npotential brute force attack?");
            return;
        }
        console.log(request.connection.remoteAddress.toString() + " accessed: " + filename + " with response: " + response.statusCode);
        Log2File(request.connection.remoteAddress.toString() + " accessed: " + filename + " with response: " + response.statusCode);

        if (fs.statSync(filename).isDirectory()) filename += 'index.html';

        fs.readFile(filename, "binary", function (err, file) {
            if (err) {
                response.writeHead(500, { "Content-Type": "text/plain" });
                response.write(err + "\n");
                response.end();
                return;
            }
            response.writeHead(200);
            response.write(file, "binary");
            response.end();
        });
    });
}).listen(parseInt(port, 10));

console.log("WebServerHost is now running at\n => http://localhost:" + port + "/\nCTRL + C to shutdown");
Log2File("WebServerHost is now running at\n => http://localhost:" + port + "/\nCTRL + C to shutdown");

//logging function formatted ISO8601: YYYY-MM-DD HH:MM:SS 
function Log2File(inputString) {
    const logFilePath = './SelfWebHost.log';
    let current = new Date();
    let cDate = current.getFullYear() + '-' + (current.getMonth() + 1) + '-' + current.getDate();
    let cTime = current.getHours() + ":" + current.getMinutes() + ":" + current.getSeconds();
    let dateTime = cDate + ' ' + cTime;
  
    fs.appendFile(logFilePath, dateTime + " | " + inputString + '\n', (err) => {
        if (err) {
            console.log('Failed to write string to file!');
        }
    });
}