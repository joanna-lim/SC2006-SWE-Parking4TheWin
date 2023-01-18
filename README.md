# SC2006-SWE-Parking4TheWin
This project was made as a submission for the course module SC2006 Software Engineering, NTU. 
By Min Khant, Jun Xiong, Ruxing, Ivan, Qiu Zhen. 

## Building and using docker containers for local development
- First, you must have the repository cloned on your system
- Secondly, ensure that you have Docker [installed](https://docs.docker.com/get-docker/) 
  on your system. You can either install Docker or Docker Desktop(GUI). Docker Desktop allows
  you to view and manage your images/containers but you must create/build them by CLI.

### Creating the image
Ensure that you are in the repository directory and ensure that you ***remain in the directory***
when doing the steps below.(**Important**)
```
$ ls
/home/wsldeb/repos/SC2006-SWE-Parking4TheWin
```
Build the docker image and ensure that the image has been created properly.
```
$ docker image build -t image_name ./
...
$ docker image ls
REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
image_name      latest    c6871d5a95a1   10 seconds ago   1.01GB
```

### Creating the container from the image
You can create multiple containers from the image. Think of the image as a starting point for all
containers. You can delete and create a new container if you messed up your development environment
in the container - and it will be the same every time.

Take note of the directory that your directory is in by using `pwd` or `ls`.
```
$ pwd
/home/wsldeb/repos/SC2006-SWE-Parking4TheWin
```
Replace YOUR_DIRECTORY below with the directory that you are in. In my case it would be
`/home/wsldeb/repos/SC2006-SWE-Parking4TheWin/SC2006/SC2006:/app`
```
$ docker container create --name container_name -p 8000:8000 -v "YOUR_DIRECTORY/SC2006/SC2006:/app" image_name
83d6aa5072fdda...
```
Ensure that the container has been created.
```
$ docker container ls -a
CONTAINER ID   IMAGE     COMMAND                  CREATED          STATUS    PORTS     NAMES
3e3cf8cb0db4   image_name    "/bin/sh -c 'python …"   12 seconds ago   Created             container_name
```

### Managing containers
Use Docker Desktop to start and stop your containers. Alternatively use `docker container start container_name`,
`docker container stop container_name` on your command line.

### Development
Start the container that you have created and visit http://localhost:8000/ on your browser to view the web app.
Changes to the code should be reflected immediately on the browser (after refreshing).
