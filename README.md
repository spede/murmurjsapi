# murmurjsapi
RESTful api for Murmur written in JavaScript

# Work-in-progress

**Dependencies**
> https, 
> express, 
> fs, 
> body-parser, 
> ice

Create a Murmur.js with slice2js.

nginx proxy pass to /etc/nginx/sites-enabled/default:

```
location /api/ {
  proxy_pass https://127.0.0.1:15000;
}
```

nginx header to expose ip to /etc/nginx/nginx.conf:

```
proxy_set_header x-real-ip $remote_addr;
```

Endpoints:
https://yourdomain.tld/api/mumble/

**Systemd start (Debian specific)**

```
/etc/systemd/system/mumbleapi.service:

[Unit]
Description=Mumble API

[Service]
ExecStart=/usr/bin/node /dir/to/server.js
Restart=on-failure
User=mumble-server
Group=mumble-server
Environment=PATH=/usr/bin:/usr/local/bin:/usr/sbin
Environment=NODE_ENV=production
WorkingDirectory=/opt/node/mumble

[Install]
WantedBy=multi-user.target
```

Then finally `sudo systemctl start mumbleapi.service`
