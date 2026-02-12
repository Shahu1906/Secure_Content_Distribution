import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def generate_key():
    return os.urandom(32)  # 256-bit AES key


def encrypt_file(file_bytes: bytes):
    key = generate_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)

    encrypted_data = aesgcm.encrypt(nonce, file_bytes, None)

    return encrypted_data, key, nonce


def decrypt_file(encrypted_data: bytes, key: bytes, nonce: bytes):
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, encrypted_data, None)
