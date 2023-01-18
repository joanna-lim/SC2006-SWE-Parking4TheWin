FROM python:3.11.0

RUN apt-get update -y && apt-get upgrade -y --no-install-recommends

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

EXPOSE 8000
CMD python manage.py migrate; python manage.py runserver 0.0.0.0:8000
