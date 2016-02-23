# murmurjsapi
RESTful api for Murmur written in JavaScript

Work-in-progress

Dependencies (npm):
https, express, fs, body-parser, ice

Create a Murmur.js with slice2js.

nginx proxy pass to /etc/nginx/sites-enabled/default:
[code]
location /api/ {
  proxy_pass https://127.0.0.1:15000;
}
[/code]

nginx header to expose ip to /etc/nginx/nginx.conf:
[code]
proxy_set_header x-real-ip $remote_addr;
[/code]

Endpoints:
https://yourdomain.tld/api/mumble/

