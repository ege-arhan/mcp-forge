# Örnek: not defteri

`forge create` + `forge add tool` + `forge add resource` ile üretilmiş,
gerçek iş yapan bellek-içi not defteri. Tool + resource birlikte nasıl
çalışır gösterir:

- `not_ekle` — `{"not": "süt al"}` → `eklendi (1): süt al`
- `forge://notlar` — eklenen notları numaralı liste olarak döndürür

Kurallar: boş not reddedilir, 500 karakter üstü reddedilir.
Tek işlem ömürlüdür (restart sıfırlar). Hello şablonundaki
`hello_world` tool'u ve `forge://readme` aynen durur.

## Python

```bash
cd python
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"not_ekle","arguments":{"not":"süt al"}}}' \
 '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"forge://notlar"}}' \
 | python3 server.py
```

## TypeScript

```bash
cd ts
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"not_ekle","arguments":{"not":"süt al"}}}' \
 '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"forge://notlar"}}' \
 | node server.ts
```

## Nasıl üretildi

```bash
node cli/forge.js create notes --template python
node cli/forge.js add tool not_ekle --dir notes
node cli/forge.js add resource notlar --dir notes
# sonra handler gövdesi + reader gerçek işe göre düzenlendi
# (bellek-içi liste, forge anchor satırları korundu)
```
