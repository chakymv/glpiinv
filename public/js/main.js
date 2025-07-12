document.addEventListener('DOMContentLoaded', () => {
    // Lógica para el selector de tipo de activo
    const tipoActivoSelect = document.getElementById('tipoActivoSelect');
    if (tipoActivoSelect) {
        tipoActivoSelect.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            if (selectedType) {
                window.location.href = `/inventory/${selectedType}`;
            }
        });
    }

    // Lógica para la barra de búsqueda y filtros
    const searchBar = document.getElementById('searchBar');
    const estadoSelect = document.getElementById('estadoSelect');
    const inventoryTable = document.getElementById('inventoryTable');

    function filterTable() {
        const searchText = searchBar ? searchBar.value.toLowerCase() : '';
        const estadoFilter = estadoSelect ? estadoSelect.value.toLowerCase() : '';

        if (inventoryTable) {
            const rows = inventoryTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const numeroInventario = row.cells[1].textContent.toLowerCase();
                const fabricante = row.cells[2].textContent.toLowerCase();
                const modelo = row.cells[3].textContent.toLowerCase();
                const serial = row.cells[4].textContent.toLowerCase();
                const estado = row.cells[5].textContent.toLowerCase();
                const usuarioAsignado = row.cells[6].textContent.toLowerCase();

                const matchesSearch = searchText === '' || 
                                      numeroInventario.includes(searchText) ||
                                      fabricante.includes(searchText) ||
                                      modelo.includes(searchText) ||
                                      serial.includes(searchText) ||
                                      usuarioAsignado.includes(searchText);

                const matchesEstado = estadoFilter === '' || estado === estadoFilter;

                if (matchesSearch && matchesEstado) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
    }

    if (searchBar) {
        searchBar.addEventListener('keyup', filterTable);
    }
    if (estadoSelect) {
        estadoSelect.addEventListener('change', filterTable);
    }

    // Lógica para el botón de exportar (si tienes implementada la exportación en el backend)
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const currentType = window.location.pathname.split('/').pop();
            // Asegúrate de que esta ruta coincida con tu endpoint de exportación en el backend
            window.location.href = `/export/${currentType}`; 
        });
    }

    // Lógica para agregar equipo a un acta (si tienes un modal para esto)
    // Asumo que tienes un modal para crear actas y que este botón lo abre.
    // Aquí solo se prepara la data para ser usada por otro modal o función.
    document.querySelectorAll('.select-item-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const itemId = event.currentTarget.dataset.id;
            const itemType = event.currentTarget.dataset.type;
            const inventoryNumber = event.currentTarget.dataset.inventory;
            const serial = event.currentTarget.dataset.serial;
            const fabricante = event.currentTarget.dataset.fabricante;
            const modelo = event.currentTarget.dataset.modelo;

            // Aquí puedes llamar a una función para abrir el modal de creación de actas
            // y pasarle esta información. Por ejemplo:
            // openActaCreationModal({ id: itemId, type: itemType, inventory: inventoryNumber, serial, fabricante, modelo });
            
            // Para propósitos de demostración, solo imprimimos en consola
            console.log('Item seleccionado para acta:', {
                id: itemId,
                type: itemType,
                inventory: inventoryNumber,
                serial: serial,
                fabricante: fabricante,
                modelo: modelo
            });
            alert(`Equipo ${inventoryNumber} (${itemType}) listo para ser añadido a un acta.`);
        });
    });
});