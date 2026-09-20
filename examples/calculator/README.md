# Örnek: hesap makinesi

`forge create` + `forge add tool` ile üretilmiş, gerçek iş yapan
iki dilli örnek. Her ikisi de aynı iki tool'u sunar:

- `topla` — `{"sayilar": [2, 3, 5]}` → `toplam: 10`
- `carp` — `{"sayilar": [2, 3, 5]}` → `carpim: 30`

Geçersiz girdi (`sayilar` dizi değilse) sunucuyu çökertmez,
`hata: sayilar dizi olmali: [1, 2, 3]` döndürür.

## Python

```bash
cd python
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"topla","arguments":{"sayilar":[2,3,5]}}}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"carp","arguments":{"sayilar":[2,3,5]}}}' \
 | python3 server.py
```

## TypeScript

```bash
cd ts
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"topla","arguments":{"sayilar":[2,3,5]}}}' \
 | node server.ts
```

## Nasıl üretildi

```bash
node cli/forge.js create calc --template python
node cli/forge.js add tool topla --dir calc
node cli/forge.js add tool carp --dir calc
# sonra handler gövdeleri + inputSchema gerçek işe göre düzenlendi
```
