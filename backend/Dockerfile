FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
 
RUN addgroup -S taskflow && adduser -S taskflow -G taskflow
USER taskflow
 
COPY target/*.jar app.jar
 
EXPOSE 8080
 
ENTRYPOINT ["java", "-jar", "app.jar"]
 