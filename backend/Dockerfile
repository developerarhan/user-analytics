FROM python:3.11-slim

RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --no-create-home appuser

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

ENV WEB_CONCURRENCY=2

CMD [ "sh", "-c", "gunicorn \
        --bind 0.0.0.0:${PORT:-5000} \
        --workers ${WEB_CONCURRENCY}\
        --timeout 60 \
        --access-logfile -\
        --error-logfile -\
        app:app" ]
