FROM python:3.12-slim
WORKDIR /app
COPY templates/python/hello/server.py ./server.py
CMD ["python3", "server.py"]
