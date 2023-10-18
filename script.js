window.onload = function() {
    fetchDevices();
};

function fetchDevices() {
    fetch('/api/devices')
    .then(response => response.json())
    .then(devices => {
        const deviceList = document.getElementById('deviceList');
        deviceList.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device;
            option.textContent = device;
            deviceList.appendChild(option);
        });
    });
}

function sendCommand() {
    const device = document.getElementById('deviceList').value;
    const command = document.getElementById('commandInput').value;

    fetch('/api/send-command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            device: device,
            command: command
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('Command sent successfully!');
        } else {
            alert('Failed to send command.');
        }
    });
}
