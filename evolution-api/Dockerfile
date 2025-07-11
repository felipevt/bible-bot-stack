FROM atendai/evolution-api:v2.2.0

# Criar diretórios necessários para persistência
RUN mkdir -p /evolution/instances /evolution/store

# Expor porta
EXPOSE 8080

# Definir workdir
WORKDIR /evolution

# O comando padrão já está definido na imagem base