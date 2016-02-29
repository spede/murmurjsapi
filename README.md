# murmurjsapi
RESTful api for Murmur written in JavaScript and Ice

# Work-in-progress

By default at https://yourdomain.tld/api/mumble

| Endpoint              	|    Arguments                  | Desc                          |
|---                    	|---                            |---                            |
| **GET**               	|                               |                               |
|                       	|                               |                               |
| /:server/user/:user   	| session id                    | Returns the User struct	|
| /:server/userbyname/:user	| username			| Returns the User struct	|
| /:server/users        	|                               | Returns the full UserMap      |
| /:server/channels     	|                               | Returns the full ChannelMap   |
| /:server/status       	|                               | Returns uptime and usercount  |
| /:server/hit          	|                               | Returns the User struct for   |
|                       	|                               | the remote address            |
| **POST**              	|                               |                               |
| /:server/message      	| target, msg                   | :msg to :target on :server    |
| /:server/kick         	| target, reason                | Kick :target from :server     |

Notes:
- nginx location /api/ -> https://127.0.0.1:15000
- add nginx header "x-real-ip"
