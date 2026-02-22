# cosmic-horizons-casa-data service Dockerfile
# based on lightweight Python image; provides FastAPI microservice

FROM python:3.11-slim

# install python dependencies from requirements file
USER root
COPY ../astro_service/requirements.txt /opt/astro_service/requirements.txt
RUN pip install -r /opt/astro_service/requirements.txt

# copy service code (run-image script will be mounted via volume at /data)
COPY ../astro_service /opt/astro_service

# working directory
WORKDIR /opt/astro_service

# environment defaults
ENV DATA_DIR=/data
ENV REDIS_URL=redis://localhost:6379

# expose HTTP port
EXPOSE 8080

ENTRYPOINT ["python", "main.py"]
