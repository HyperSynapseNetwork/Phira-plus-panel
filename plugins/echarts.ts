import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { defineNuxtPlugin } from 'nuxt/app'

/** Register the ECharts modules used by dashboard charts (design §18.2). */
export default defineNuxtPlugin(() => {
  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
  ])
})
