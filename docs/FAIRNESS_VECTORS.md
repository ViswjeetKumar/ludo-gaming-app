# Fairness Protocol and Test Vectors

**Algorithm version:** `ludo-fairness-v1`  
**Test data warning:** all values below are fixed public test inputs, never production seeds or player nonces.

## Protocol

1. The roll/fairness service obtains a 32-byte `server_seed` from the OS cryptographic RNG and stores it only in envelope-encrypted `GAME_SECRETS`.
2. Publish `server_seed_commitment = SHA-256(server_seed)`.
3. Each player generates a 32-byte client nonce with its platform CSPRNG and submits `SHA-256(client_nonce)`.
4. After every commitment is present, players reveal their nonce. Validate every reveal and order entries by frozen `seat_index` ascending.
5. Derive `final_seed = HMAC-SHA-256(server_seed, final_seed_message)`.
6. For each roll, derive an HMAC block from `final_seed`, consume bytes in order, accept the first byte below 252 and compute `outcome = (byte mod 6) + 1`.
7. If all 32 bytes of a block are 252–255, increment fallback counter and HMAC a new roll message. Repeat until an accepted byte exists. Persist the counter/accepted-byte index in the roll proof digest or deterministically recompute it from the public proof.
8. At terminal finish/void, disclose server seed and player nonce proof. Verify commitment, final seed, every roll, frozen rules and event hash chain.

A missing/invalid player reveal before the first roll cancels start and returns the room to lobby without penalty. A server abort after seeing commitments remains a residual bias risk; monitor commitment-to-start abort rate and alert on anomalies.

## Canonical binary encoding

All integer fields are unsigned fixed-width big-endian. UUID is exactly 16 RFC 4122 network-order bytes. Labels are ASCII bytes without a length prefix because each is fixed by the algorithm version. Concatenation is raw bytes: no separators, JSON, Unicode normalization, strings, whitespace or variable-width integers.

### Final-seed message

```text
0x01
|| ASCII("LUDO-FINAL-SEED-V1")
|| game_id_uuid[16]
|| player_count_u8
|| repeated player_count times in seat_index ascending:
     seat_index_u8 || client_nonce[32]
```

### Roll message

```text
0x01
|| ASCII("LUDO-DICE-ROLL-V1")
|| game_id_uuid[16]
|| turn_number_u32_be
|| roll_index_u32_be
|| fallback_counter_u32_be
```

The initial fallback counter is 0. Never replace rejection sampling with `byte % 6` for bytes 252–255, because it introduces modulo bias.

## Published vector

Inputs:

| Field | Hex/value |
|---|---|
| server seed | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| game ID | `00112233-4455-6677-8899-aabbccddeeff` |
| player count | `02` |
| seat 0 nonce | `202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f` |
| seat 1 nonce | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |

Expected values:

| Item | Expected hex / outcome |
|---|---|
| SHA-256(server seed) | `630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd` |
| final-seed message | `014c55444f2d46494e414c2d534545442d563100112233445566778899aabbccddeeff0200202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f01404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| final seed | `d0c66ca4210f6f7c62a3d852b6c40bf1e98e0812a440495c56ad88eb3a2589b6` |
| turn 1, roll 1, counter 0 input | `014c55444f2d444943452d524f4c4c2d563100112233445566778899aabbccddeeff000000010000000100000000` |
| turn 1, roll 1 HMAC | `24357477665054264966f60c83462632916d5eb86a72b90f88aa7737d773c922` |
| turn 1, roll 1 | first byte `0x24`; outcome **1** |
| turn 1, roll 2, counter 0 input | `014c55444f2d444943452d524f4c4c2d563100112233445566778899aabbccddeeff000000010000000200000000` |
| turn 1, roll 2 HMAC | `f423b789d061c90fce783011efd5afbdfbeb91da13351c66ef5dcb833114f6ca` |
| turn 1, roll 2 | first byte `0xf4`; outcome **5** |
| turn 1, roll 3, counter 0 input | `014c55444f2d444943452d524f4c4c2d563100112233445566778899aabbccddeeff000000010000000300000000` |
| turn 1, roll 3 HMAC | `07635efca9d1ffe24bc29b58b6e330780b6b81b3aeab4401a108221042945e10` |
| turn 1, roll 3 | first byte `0x07`; outcome **2** |

The fallback path is deterministic but this document does not invent a 32-byte all-rejected HMAC vector. Phase 4 must test it using an injected deterministic HMAC source that returns 32 bytes in `[252,255]`, then verify counter 1 is used.

## Reproducibility evidence

**Environment:** Windows PowerShell; OpenSSL 3.1.4 24 Oct 2023. Python was unavailable.

The following real commands were executed in scratch directory `C:\Users\loveu\Documents\Codex\2026-11-01\fairness-scratch`, outside this Git repository. `certutil -decodehex ... 4` decoded the public hexadecimal test inputs to binary; OpenSSL generated the digests.

```powershell
$seedHex = (Get-Content -Raw .\server-seed.hex).Trim()
openssl dgst -sha256 .\server-seed.bin
openssl dgst -sha256 -mac HMAC -macopt "hexkey:$seedHex" .\vector-final-message.bin
openssl dgst -sha256 -mac HMAC -macopt "hexkey:d0c66ca4210f6f7c62a3d852b6c40bf1e98e0812a440495c56ad88eb3a2589b6" .\roll-1-message.bin
openssl dgst -sha256 -mac HMAC -macopt "hexkey:d0c66ca4210f6f7c62a3d852b6c40bf1e98e0812a440495c56ad88eb3a2589b6" .\roll-2-message.bin
openssl dgst -sha256 -mac HMAC -macopt "hexkey:d0c66ca4210f6f7c62a3d852b6c40bf1e98e0812a440495c56ad88eb3a2589b6" .\roll-3-message.bin
```

Results matched every expected digest above. The published test seed is fixed, non-secret test data and is not usable by any match.
