import React, { useEffect, useState } from 'react';
import './SeatBooking.css';

const SEAT_STATUS = {
    AVAILABLE: 'available',
    SELECTED: 'selected',
    BOOKED: 'booked'
};

const SEAT_PRICES = {
    PREMIUM: 1000,  // Rows A-C (0-2)
    STANDARD: 750,  // Rows D-F (3-5)
    ECONOMY: 500    // Rows G-H (6-7)
};

const MAX_SEATS_PER_BOOKING = 8;

const STORAGE_KEY = 'greenstitch-seat-bookings-v1';

const SeatBooking = () => {
    const ROWS = 8;
    const SEATS_PER_ROW = 10;

    const initializeSeats = () => {
        const seats = [];
        for (let row = 0; row < ROWS; row++) {
            const rowSeats = [];
            for (let seat = 0; seat < SEATS_PER_ROW; seat++) {
                rowSeats.push({
                    id: `${row}-${seat}`,
                    row: row,
                    seat: seat,
                    status: SEAT_STATUS.AVAILABLE
                });
            }
            seats.push(rowSeats);
        }
        return seats;
    };

    const [seats, setSeats] = useState(initializeSeats());

    // Load persisted bookings on first render
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (!stored) return;
            const bookedIds = JSON.parse(stored);
            if (!Array.isArray(bookedIds)) return;

            setSeats(prev =>
                prev.map(row =>
                    row.map(seat =>
                        bookedIds.includes(seat.id)
                            ? { ...seat, status: SEAT_STATUS.BOOKED }
                            : seat
                    )
                )
            );
        } catch (e) {
            console.error('Failed to load stored bookings', e);
        }
    }, []);

    const getSeatPrice = (rowIndex) => {
        if (rowIndex <= 2) return SEAT_PRICES.PREMIUM;
        if (rowIndex <= 5) return SEAT_PRICES.STANDARD;
        return SEAT_PRICES.ECONOMY;
    };

    const flattenSeats = () => seats.flat();

    const getSelectedCount = () =>
        flattenSeats().filter(seat => seat.status === SEAT_STATUS.SELECTED).length;

    const getBookedCount = () =>
        flattenSeats().filter(seat => seat.status === SEAT_STATUS.BOOKED).length;

    const getAvailableCount = () =>
        flattenSeats().filter(seat => seat.status === SEAT_STATUS.AVAILABLE).length;

    const calculateTotalPrice = () => {
        return seats.reduce((total, row, rowIndex) => {
            const price = getSeatPrice(rowIndex);
            const selectedInRow = row.filter(seat => seat.status === SEAT_STATUS.SELECTED).length;
            return total + selectedInRow * price;
        }, 0);
    };

    const wouldViolateContinuity = (nextSeats, rowIndex, seatIndex) => {
        const row = nextSeats[rowIndex];
        const left = row[seatIndex - 1];
        const right = row[seatIndex + 1];

        if (!left || !right) return false;

        const isLeftBlocking = left.status === SEAT_STATUS.SELECTED || left.status === SEAT_STATUS.BOOKED;
        const isRightBlocking = right.status === SEAT_STATUS.SELECTED || right.status === SEAT_STATUS.BOOKED;

        const middle = row[seatIndex];
        const isMiddleAvailable = middle.status === SEAT_STATUS.AVAILABLE;

        return isLeftBlocking && isRightBlocking && isMiddleAvailable;
    };

    const handleSeatClick = (rowIndex, seatIndex) => {
        setSeats(prevSeats => {
            const current = prevSeats[rowIndex][seatIndex];

            if (current.status === SEAT_STATUS.BOOKED) {
                return prevSeats;
            }

            const currentlySelectedCount = flattenSeats().filter(
                seat => seat.status === SEAT_STATUS.SELECTED
            ).length;

            if (current.status === SEAT_STATUS.AVAILABLE && currentlySelectedCount >= MAX_SEATS_PER_BOOKING) {
                window.alert(`You can book a maximum of ${MAX_SEATS_PER_BOOKING} seats per transaction.`);
                return prevSeats;
            }

            const updated = prevSeats.map(row => row.map(seat => ({ ...seat })));

            const seat = updated[rowIndex][seatIndex];

            if (seat.status === SEAT_STATUS.AVAILABLE) {
                seat.status = SEAT_STATUS.SELECTED;
            } else if (seat.status === SEAT_STATUS.SELECTED) {
                seat.status = SEAT_STATUS.AVAILABLE;
            }

            if (wouldViolateContinuity(updated, rowIndex, seatIndex)) {
                window.alert('You cannot leave a single available seat between selected/booked seats.');
                return prevSeats;
            }

            return updated;
        });
    };

    const handleBookSeats = () => {
        const selectedSeats = flattenSeats().filter(s => s.status === SEAT_STATUS.SELECTED);

        if (selectedSeats.length === 0) return;

        if (selectedSeats.length > MAX_SEATS_PER_BOOKING) {
            window.alert(`You can book a maximum of ${MAX_SEATS_PER_BOOKING} seats per transaction.`);
            return;
        }

        const totalPrice = selectedSeats.reduce((sum, seat) => sum + getSeatPrice(seat.row), 0);

        const confirmed = window.confirm(
            `You are about to book ${selectedSeats.length} seat(s) for a total of ₹${totalPrice}.\nDo you want to proceed?`
        );

        if (!confirmed) return;

        setSeats(prevSeats => {
            const updated = prevSeats.map(row => row.map(seat => ({ ...seat })));

            selectedSeats.forEach(selected => {
                const { row, seat } = selected;
                if (updated[row][seat].status === SEAT_STATUS.SELECTED) {
                    updated[row][seat].status = SEAT_STATUS.BOOKED;
                }
            });

            try {
                const allBookedIds = updated
                    .flat()
                    .filter(s => s.status === SEAT_STATUS.BOOKED)
                    .map(s => s.id);
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allBookedIds));
            } catch (e) {
                console.error('Failed to persist bookings', e);
            }

            return updated;
        });
    };

    const handleClearSelection = () => {
        setSeats(prevSeats =>
            prevSeats.map(row =>
                row.map(seat =>
                    seat.status === SEAT_STATUS.SELECTED
                        ? { ...seat, status: SEAT_STATUS.AVAILABLE }
                        : seat
                )
            )
        );
    };

    const handleReset = () => {
        const confirmed = window.confirm('This will clear all bookings and reset all seats. Continue?');
        if (!confirmed) return;

        setSeats(initializeSeats());
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Failed to clear persisted bookings', e);
        }
    };

    return (
        <div className="seat-booking-container">
            <h1>GreenStitch Seat Booking System</h1>

            <div className="info-panel">
                <div className="info-item">
                    <span className="info-label">Available:</span>
                    <span className="info-value">{getAvailableCount()}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Selected:</span>
                    <span className="info-value">{getSelectedCount()}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Booked:</span>
                    <span className="info-value">{getBookedCount()}</span>
                </div>
            </div>

            <div className="legend">
                <div className="legend-item">
                    <div className="seat-demo available"></div>
                    <span>Available</span>
                </div>
                <div className="legend-item">
                    <div className="seat-demo selected"></div>
                    <span>Selected</span>
                </div>
                <div className="legend-item">
                    <div className="seat-demo booked"></div>
                    <span>Booked</span>
                </div>
            </div>

            <div className="seat-grid">
                {seats.map((row, rowIndex) => (
                    <div key={rowIndex} className="seat-row">
                        <div className="row-label">{String.fromCharCode(65 + rowIndex)}</div>
                        {row.map((seat, seatIndex) => (
                            <div
                                key={seat.id}
                                className={`seat ${seat.status}`}
                                onClick={() => handleSeatClick(rowIndex, seatIndex)}
                            >
                                {seatIndex + 1}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="pricing-info">
                <p>Selected Seats Total: <strong>₹{calculateTotalPrice()}</strong></p>
                <p className="price-note">Premium (A-C): ₹1000 | Standard (D-F): ₹750 | Economy (G-H): ₹500</p>
            </div>

            <div className="control-panel">
                <button
                    className="btn btn-book"
                    onClick={handleBookSeats}
                    disabled={getSelectedCount() === 0}
                >
                    Book Selected Seats ({getSelectedCount()})
                </button>
                <button
                    className="btn btn-clear"
                    onClick={handleClearSelection}
                    disabled={getSelectedCount() === 0}
                >
                    Clear Selection
                </button>
                <button
                    className="btn btn-reset"
                    onClick={handleReset}
                >
                    Reset All
                </button>
            </div>
        </div>
    );
};

export default SeatBooking;
