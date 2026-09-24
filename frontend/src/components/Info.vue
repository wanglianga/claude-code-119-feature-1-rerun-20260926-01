<template>
  <div class="info-item">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ label: string; value: string }>();
</script>
<style scoped>
.info-item { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.value { font-size: 14px; font-weight: 600; word-break: break-all; }
</style>
