import * as faceapi from 'face-api.js'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'

let modelsLoaded = false

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])

  modelsLoaded = true
}

export async function getDescriptor(imageUrl: string): Promise<Float32Array | null> {
  const img = await faceapi.fetchImage(imageUrl)
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection?.descriptor ?? null
}

export function compareDescriptors(d1: Float32Array, d2: Float32Array): number {
  return faceapi.euclideanDistance(d1, d2)
}

export function interpretDistance(distance: number): string {
  if (distance < 0.4) return 'Very high confidence match'
  if (distance <= 0.6) return 'Possible match (threshold boundary)'
  return 'No match'
}
