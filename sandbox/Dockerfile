FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ gcc libc6-dev python3 default-jdk-headless \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY run.sh /run.sh

RUN sed -i 's/\r$//' /run.sh && chmod +x /run.sh

USER ubuntu
WORKDIR /work
ENV HOME=/tmp PYTHONDONTWRITEBYTECODE=1

ENTRYPOINT ["/run.sh"]