# 🎨 Solana NFT Mini

A minimal on-chain NFT minting project built with **Solana**, **Metaplex**, and **TypeScript**.  
This project demonstrates how to mint NFTs, verify them within a collection, and manage metadata hosted on **IPFS (Pinata)**.

---

## 🚀 Overview

The **NFT Mini** project was developed as part of the **Encode Club Solana Rust Bootcamp**.  
It provides a simple but complete workflow to:
- Create a collection on Solana Devnet
- Upload assets and metadata to IPFS
- Mint NFTs programmatically
- Verify NFTs against a “sized” collection using Metaplex SDKs
- Display NFTs with a custom React front-end (`solana-mini-gallery`)

---

## 🧰 Tech Stack

| Layer | Technology |
|:--|:--|
| Blockchain | Solana (Devnet) |
| SDK | `@metaplex-foundation/js` |
| Network | Alchemy / Solana RPC |
| Language | TypeScript + Node.js |
| Metadata storage | Pinata / IPFS |
| Wallet | Solana CLI Keypair |
| Frontend | React + Vite (separate repo: `solana-mini-gallery`) |

---

## 🪶 Features

- 🧩 Create a **sized NFT collection**
- 🖼️ Mint NFTs from local or IPFS assets
- 🧾 Upload JSON metadata automatically
- ✅ Verify NFTs against the collection (using `verifySizedCollectionItem`)
- ⚡ Scripts with `@solana/web3.js` and Metaplex SDK
- 🔍 Easily switch between Devnet and Mainnet RPCs

---

## ⚙️ Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/<your-username>/nft-mini.git
cd nft-mini
