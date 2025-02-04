let showRSI = false;
let showSMA = false;

const toggleRSIButton = document.getElementById('toggleRSI');
const smaToggleButton = document.getElementById('toggleSMA');
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', currentTheme === 'light' ? 'dark' : 'light');
});

const recommendationContainer = document.getElementById('recommendation');

let rsiLineSeries = null;
let smaLineSeries = null;
let rsiData = [];
let smaData = [];

async function fetchBinanceData(symbol, interval, limit = 1000) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.map(candle => ({
        time: candle[0] / 1000,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
    }));
}

function calculateRSI(data, period) {
    const rsiData = [];
    const smaData = [];
    let gainSum = 0;
    let lossSum = 0;

    for (let i = 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        const gain = Math.max(change, 0);
        const loss = Math.abs(Math.min(change, 0));

        if (i <= period) {
            gainSum += gain;
            lossSum += loss;

            if (i === period) {
                const avgGain = gainSum / period;
                const avgLoss = lossSum / period;
                const rs = avgGain / avgLoss || 0;
                const rsi = 100 - 100 / (1 + rs);

                rsiData.push({ time: data[i].time, value: rsi });
            }
        } else {
            const prevAvgGain = rsiData[rsiData.length - 1]?.avgGain || (gainSum / period);
            const prevAvgLoss = rsiData[rsiData.length - 1]?.avgLoss || (lossSum / period);

            const avgGain = (prevAvgGain * (period - 1) + gain) / period;
            const avgLoss = (prevAvgLoss * (period - 1) + loss) / period;
            const rs = avgGain / avgLoss || 0;
            const rsi = 100 - 100 / (1 + rs);

            rsiData.push({ time: data[i].time, value: rsi, avgGain, avgLoss });
        }
    }

    return rsiData;
}

function calculateSMA(data, period) {
    const smaData = [];
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;

        if (i >= period - 1) {
            if (i >= period) {
                sum -= data[i - period].close;
            }
            const sma = sum / period;
            smaData.push({ time: data[i].time, value: sma });
        }
    }

    return smaData;
}

const chartContainer = document.getElementById('chart');
let chart = LightweightCharts.createChart(chartContainer,{
    width: chartContainer.offsetWidth,
    height: chartContainer.offsetHeight,
});



let candleSeries = chart.addCandlestickSeries();
const candlestickSeries = chart.addCandlestickSeries()

async function updateChart(symbol) {
    const interval = '4h';
    const rsiPeriod = 14;

    const data = await fetchBinanceData(symbol, interval);
    candleSeries.setData(data);

    rsiData = calculateRSI(data, rsiPeriod);
    smaData = calculateSMA(data, rsiPeriod);

    const latestRSI = rsiData[rsiData.length - 1]?.value || 0;
    const latestSMA = smaData[smaData.length - 1]?.value || 0;
    const price = data[data.length - 1]?.close || 0;

    let recommendation = 'LAUKTI';
    let recommendationColor = 'yellow';

    if (latestRSI < 30) {
        recommendation = 'PIRKTI';
        recommendationColor = 'green';
    } else if (latestRSI > 70) {
        recommendation = 'PARDUOTI';
        recommendationColor = 'red';
    }

    recommendationContainer.innerHTML = `
        <p><strong>Patartina:</strong> <span style="color: ${recommendationColor};">${recommendation}</span></p>
        <p>RSI indeksas: ${latestRSI.toFixed(2)}</p>
        <p>Dabartinė kaina: $${price.toFixed(2)}</p>
    `;
    buySellMarkers = [];
    const rsiOverbought = 70;
    const rsiOversold = 30;
    const signalGap = 0;
    let lastBuySignal = -signalGap;
    let lastSellSignal = -signalGap;

    rsiData.forEach((point, index) => {
        if (point.value >= rsiOverbought && index - lastSellSignal >= signalGap) {
            buySellMarkers.push({
                time: point.time,
                position: 'aboveBar',
                color: 'red',
                shape: 'arrowDown',
                text: 'Sell',
            });
            lastSellSignal = index;
        } else if (point.value <= rsiOversold && index - lastBuySignal >= signalGap) {
            buySellMarkers.push({
                time: point.time,
                position: 'belowBar',
                color: 'blue',
                shape: 'arrowUp',
                text: 'MustBuy',
            });
            lastBuySignal = index;
        }
    });
    
    
    candleSeries.setMarkers(buySellMarkers);

    if(showSMA){
        if(!smaLineSeries){
    smaLineSeries = chart.addLineSeries({
    color: 'blue',
    lineWidth: '2',
    priceScaleId: 'sma-scale',
});
        }
smaLineSeries.setData(smaData);
    }    else if (smaLineSeries){
            chart.removeSeries(smaLineSeries);
            smaLineSeries = null;
        }
    


    if (showRSI) {
        if (!rsiLineSeries) {
            rsiLineSeries = chart.addLineSeries({
                color: 'orange',
                lineWidth: 2,
                priceScaleId: 'rsi-scale',
            });
        }
        rsiLineSeries.setData(rsiData);
    } else if (rsiLineSeries) {
        chart.removeSeries(rsiLineSeries);
        rsiLineSeries = null;
    }

}
const symbolSelect = document.getElementById('symbol');
symbolSelect.addEventListener('change', () => updateChart(symbolSelect.value));

updateChart(symbolSelect.value);

toggleRSIButton.addEventListener('click', () => {
    showRSI = !showRSI; 
    toggleRSIButton.textContent = showRSI ? 'Paslėpti RSI linija' : 'Rodyti RSI linija'; // Pasikeicia mygtuko tekstas
    if (rsiLineSeries) {
        chart.removeSeries(rsiLineSeries);
        rsiLineSeries = null;
    }
    updateChart(symbolSelect.value); 

});
    smaToggleButton.addEventListener('click', () =>{
        showSMA = !showSMA;
        smaToggleButton.textContent = showSMA ? 'Paslepti SMA linija' : 'Parodyti SMA linija';
        if (smaLineSeries) {
        chart.removeSeries(smaLineSeries);
        smaLineSeries = null;
    }
    updateChart(symbolSelect.value);
    });

