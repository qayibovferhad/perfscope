# Shared by every proxied location. `X-Forwarded-For` is what the backend's request log
# records as the client: without it every line says this proxy's container address, and
# "which client was hammering us at four o'clock" has no answer. The backend only reads it
# because `trust proxy` is set to one hop — see config.trustProxy.
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
