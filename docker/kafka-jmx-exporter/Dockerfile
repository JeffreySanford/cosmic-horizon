FROM eclipse-temurin:17-jdk

ARG JMX_EXPORTER_VERSION=0.16.0
WORKDIR /opt/jmx-exporter

# Install curl for downloading the jar during image build
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Download jmx_prometheus_httpserver jar from Maven Central
RUN curl -sSL -o jmx_prometheus_httpserver.jar \
  https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_httpserver/${JMX_EXPORTER_VERSION}/jmx_prometheus_httpserver-${JMX_EXPORTER_VERSION}.jar

EXPOSE 9404

# The exporter config is mounted at runtime via docker-compose volume
ENTRYPOINT ["java", "-jar", "/opt/jmx-exporter/jmx_prometheus_httpserver.jar"]
CMD ["9404", "/etc/jmx-exporter/config.yml", "cosmic-horizons-kafka:9999"]
