# Select the base image
FROM nadavtasher/template:2021.03.28

# Install dependancies
RUN npm install discord.js@12.5.3
RUN apt install docker.io

# Copy sources
COPY sources/backend backend
COPY sources/frontend frontend