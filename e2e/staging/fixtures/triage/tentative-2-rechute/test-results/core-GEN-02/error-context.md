# Test info

- Name: GEN — génération › GEN-02 — les modèles Anthropic répondent en streaming, avec titre généré
- Location: /home/runner/work/vermeer-text/vermeer-text/e2e/staging/tests/core.spec.ts:48:7
- Tags: @wave1 @canary

# Error details

```
Error: Anthropic /Opus 4\.8/ — aucun titre généré pour la conversation
8f2c41ba-19d7-4e6f-9a15-c0b7e5d3a204 (elle reste sans titre dans la sidebar).

Timed out 60000ms waiting for expect(polling).not.toMatch(expected)

Expected pattern: /Nouvelle discussion|New chat/i
Received string:  "Nouvelle discussion"
```

# Page snapshot

```yaml
- navigation "Conversations":
  - link "Nouvelle discussion" [current=page]
```
