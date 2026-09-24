<template>
  <router-view />
  <div v-if="error" class="global-error" @click="error = ''">{{ error }}</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const error = ref('');
let timer: any = null;
function onError(e: any) {
  error.value = e.detail;
  clearTimeout(timer);
  timer = setTimeout(() => (error.value = ''), 4000);
}
onMounted(() => window.addEventListener('api-error', onError));
onUnmounted(() => window.removeEventListener('api-error', onError));
</script>

<style>
.global-error {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  background: #d9534f; color: #fff; padding: 10px 22px; border-radius: 8px;
  font-size: 14px; z-index: 9999; box-shadow: 0 6px 20px rgba(0,0,0,.2);
  cursor: pointer;
}
</style>
