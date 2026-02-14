# Duet TURN Server - Terraform Configuration
# Supports: AWS, GCP, DigitalOcean
# Usage: terraform init && terraform apply

terraform {
  required_version = ">= 1.0"

  required_providers {
    # Uncomment the provider you want to use

    # AWS
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.0"
    # }

    # Google Cloud
    # google = {
    #   source  = "hashicorp/google"
    #   version = "~> 5.0"
    # }

    # DigitalOcean (recommended for simplicity)
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# =====================
# VARIABLES
# =====================

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Deployment region"
  type        = string
  default     = "nyc1"
}

variable "turn_username" {
  description = "TURN server username"
  type        = string
  default     = "duet"
}

variable "turn_password" {
  description = "TURN server password"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Domain for TURN server (optional, for TLS)"
  type        = string
  default     = ""
}

variable "email" {
  description = "Email for Let's Encrypt (required if domain is set)"
  type        = string
  default     = ""
}

variable "ssh_public_key" {
  description = "SSH public key for droplet access"
  type        = string
}

# =====================
# DIGITALOCEAN PROVIDER
# =====================

provider "digitalocean" {
  token = var.do_token
}

# =====================
# DROPLET (VM)
# =====================

resource "digitalocean_droplet" "turn" {
  name     = "duet-turn"
  region   = var.region
  size     = "s-1vcpu-1gb"  # $6/month - sufficient for ~100 concurrent users
  image    = "docker-20-04"

  ssh_keys = [digitalocean_ssh_key.turn.fingerprint]

  user_data = templatefile("${path.module}/cloud-init.yml", {
    turn_username = var.turn_username
    turn_password = var.turn_password
    domain        = var.domain
    email         = var.email
  })

  tags = ["duet", "turn"]
}

# =====================
# SSH KEY
# =====================

resource "digitalocean_ssh_key" "turn" {
  name       = "duet-turn-key"
  public_key = var.ssh_public_key
}

# =====================
# FIREWALL
# =====================

resource "digitalocean_firewall" "turn" {
  name = "duet-turn-firewall"

  droplet_ids = [digitalocean_droplet.turn.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # STUN/TURN UDP
  inbound_rule {
    protocol         = "udp"
    port_range       = "3478"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # STUN/TURN TCP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "3478"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # TURN TLS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "5349"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP (for Let's Encrypt)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS (optional)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Media relay ports
  inbound_rule {
    protocol         = "udp"
    port_range       = "49152-65535"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Outbound - allow all
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# =====================
# DNS (Optional)
# =====================

# Uncomment if you want to manage DNS in DigitalOcean
# resource "digitalocean_domain" "turn" {
#   count = var.domain != "" ? 1 : 0
#   name  = var.domain
# }
#
# resource "digitalocean_record" "turn" {
#   count  = var.domain != "" ? 1 : 0
#   domain = digitalocean_domain.turn[0].name
#   type   = "A"
#   name   = "@"
#   value  = digitalocean_droplet.turn.ipv4_address
#   ttl    = 300
# }

# =====================
# OUTPUTS
# =====================

output "turn_server_ip" {
  description = "Public IP of the TURN server"
  value       = digitalocean_droplet.turn.ipv4_address
}

output "turn_url" {
  description = "TURN server URL"
  value       = "turn:${digitalocean_droplet.turn.ipv4_address}:3478"
}

output "turn_url_tcp" {
  description = "TURN server URL (TCP)"
  value       = "turn:${digitalocean_droplet.turn.ipv4_address}:3478?transport=tcp"
}

output "turn_url_tls" {
  description = "TURN server URL (TLS)"
  value       = var.domain != "" ? "turns:${var.domain}:5349" : "turns:${digitalocean_droplet.turn.ipv4_address}:5349"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh root@${digitalocean_droplet.turn.ipv4_address}"
}

output "app_config" {
  description = "Configuration for src/config/turn.ts"
  sensitive   = true
  value       = <<-EOT
    // Add to PRODUCTION_TURN in src/config/turn.ts:
    {
      urls: 'turn:${digitalocean_droplet.turn.ipv4_address}:3478',
      username: '${var.turn_username}',
      credential: '${var.turn_password}',
    },
    {
      urls: 'turn:${digitalocean_droplet.turn.ipv4_address}:3478?transport=tcp',
      username: '${var.turn_username}',
      credential: '${var.turn_password}',
    },
  EOT
}
