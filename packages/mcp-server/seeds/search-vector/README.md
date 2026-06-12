# Search Vector Seed Space

These files are the raw input space for `search_vector_compiler`.

Each YAML file must contain one non-empty list of unique English `snake_case`
strings:

```yaml
- first_value
- second_value
```

The compiler selects one value independently from every category. File ordering
is significant for deterministic `random_seed` results. Changing values or
their order may change the lineage returned for an existing seed.

The compiler intentionally does not evaluate compatibility, semantic quality,
history, repetition, market opportunity, or application names.

Agent interpretation references live in `../agent-reference` and are not part
of random compilation.
