//#region consts
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { setTimeout } = require('timers');
const port = 8989;

const requestsInterval = 5000;
const maxRequests = 50;
const blockedIPs = new Set();
const requestCounts = {};
//#endregion

printCoolBanner();

server = http.createServer(function (request, response) {

    var uri = url.parse(request.url).pathname
    var filename = path.join(process.cwd(), uri);
    const ConnectedUser = request.socket.remoteAddress.toString();


    //my poorly crafted attempt at blocking layer 7 attacks..
    if (blockedIPs.has(ConnectedUser)) {
        response.writeHead(403, { "Content-Type": "text/plain"});
        response.write("Forbidden\n");
        response.end();
        request.destroy();
        console.log("\x1b[31m" + ConnectedUser + " is blocked | still knocking.\x1b[0m");
        Log2File(ConnectedUser + " is blocked | still knocking.");
        return;
    }

    requestCounts[ConnectedUser] = (requestCounts[ConnectedUser] || 0) + 1;

    if (requestCounts[ConnectedUser] >= maxRequests) {
        blockUser(ConnectedUser);
        response.writeHead(403, { "Content-Type": "text/plain" });
        response.write("Forbidden\n");
        response.end();
        console.log("\x1b[33m" + ConnectedUser + " made too many requests. Redirecting..\x1b[0m");
        Log2File(ConnectedUser + " made too many requests. Redirecting..");
        request.socket.destroy();
        //forwardRequest(request, null, "https://google.com/");
        return;
    }



    fs.exists(filename, function (exists) {

        if (!exists) {
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.write("404 Not Found\n");
            response.end();
            console.log("\x1b[31m" + request.socket.remoteAddress.toString() + " tried accessing: " + filename + " with response: " + response.statusCode + "\npotential brute force attack?\x1b[0m");
            Log2File(request.socket.remoteAddress.toString() + " tried accessing: " + filename + " with response: " + response.statusCode + "\n\npotential brute force attack?");
            return;
        }
        console.log("\x1b[36m" + request.socket.remoteAddress.toString() + " accessed: " + filename + " with response: " + response.statusCode + "\x1b[0m");
        Log2File(request.socket.remoteAddress.toString() + " accessed: " + filename + " with response: " + response.statusCode);

        if (fs.statSync(filename).isDirectory()) filename += 'index.php';

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


const baseUrl = 'www.google.com';
server.on('request', (req, res) => {
  if (blockedIPs.has(server.ConnectedUser)){
    var connector = http.request({
      host: baseUrl,
      path:'/',
      method: 'GET',
      headers: req.headers
    }, (resp) => {
      resp.pipe(res);
    });
  }
});


console.log("\x1b[32mWebServerHost is now running at\n => http://localhost:" + port + "/\nCTRL + C to shutdown\x1b[0m");
Log2File("WebServerHost is now running at\n => http://localhost:" + port + "/\nCTRL + C to shutdown");


//#region functions


//prints said cool banner in magenta!
function printCoolBanner() {
  console.clear();
  var banner = [
    "\x1b[35m███╗   ██╗ ██████╗ ██████╗ ███████╗███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗\x1b[0m",
    "\x1b[35m████╗  ██║██╔═══██╗██╔══██╗██╔════╝██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗\x1b[0m",
    "\x1b[35m██╔██╗ ██║██║   ██║██║  ██║█████╗  ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝\x1b[0m",
    "\x1b[35m██║╚██╗██║██║   ██║██║  ██║██╔══╝  ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗\x1b[0m",
    "\x1b[35m██║ ╚████║╚██████╔╝██████╔╝███████╗███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║\x1b[0m",
    "\x1b[35m╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝\x1b[0m",
    "\n\n"
  ];
  banner.forEach(function(entry) {
    console.log(entry);
  });

}

  function blockUser(ip) {
    blockedIPs.add(ip);
    setTimeout(() => {
        blockedIPs.delete(ip);
        delete requestCounts[ip];
    }, requestsInterval);
}

function forwardRequest(req, res, targetUrl) {
    const requestOptions = {
      method: req.method,
      headers: req.headers,
    };
  
    const parsedUrl = url.parse(targetUrl);
    const forwardReq = http.request({
      ...requestOptions,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
    });
  
    req.pipe(forwardReq);
    forwardReq.on('response', (forwardRes) => {
      res.writeHead(forwardRes.statusCode, forwardRes.headers);
      forwardRes.pipe(res);
    });
  
    forwardReq.on('error', (err) => {
      console.error('Error forwarding request:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
  
    req.on('error', (err) => {
      console.error('Error reading incoming request:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
  
    req.on('end', () => {
      forwardReq.end();
    });
  }

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

//#endregion