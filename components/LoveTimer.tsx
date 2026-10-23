import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { getNow } from '../utils/timeService';

interface LoveTimerProps {
    startDate: string;
    size?: 'normal' | 'small';
}

interface TimeLeft {
    years: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export const LoveTimer: React.FC<LoveTimerProps> = ({ startDate, size = 'normal' }) => {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ years: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const calculateTimeLeft = () => {
            // new Date('YYYY-MM-DD') parses as UTC midnight, which would make this counter
            // disagree with calculateDaysTogether (local midnight) shown next to it.
            const start = dayjs(startDate).startOf('day').valueOf();
            const now = getNow().valueOf();
            const difference = now - start;

            if (difference > 0) {
                const years = Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
                const days = Math.floor((difference % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                setTimeLeft({ years, days, hours, minutes, seconds });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [startDate]);

    const isSmall = size === 'small';

    return (
        <div className="w-full">
            <div className={`relative ${isSmall ? 'p-2' : 'p-4'} rounded-2xl overflow-hidden`}>
                {/* Gradient border effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-sage/10 to-primary/20 animate-gradient"></div>
                <div className="absolute inset-[1px] rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-md"></div>
                
                <div className={`relative grid ${isSmall ? 'grid-cols-5 gap-1' : 'grid-cols-5 gap-2'}`}>
                    <TimeUnit value={timeLeft.years} label="年" isSmall={isSmall} />
                    <TimeUnit value={timeLeft.days} label="天" isSmall={isSmall} />
                    <TimeUnit value={timeLeft.hours} label="时" isSmall={isSmall} />
                    <TimeUnit value={timeLeft.minutes} label="分" isSmall={isSmall} />
                    <TimeUnit value={timeLeft.seconds} label="秒" isSmall={isSmall} />
                </div>
            </div>
        </div>
    );
};

const TimeUnit: React.FC<{ value: number; label: string; isLast?: boolean; isSmall?: boolean }> = ({ value, label, isLast, isSmall }) => {
    const [prevValue, setPrevValue] = useState(value);
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        if (value !== prevValue) {
            setIsFlipping(true);
            const timer = setTimeout(() => {
                setPrevValue(value);
                setIsFlipping(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [value, prevValue]);

    return (
        <div className="flex flex-col items-center justify-center">
            <div className={`relative ${isSmall ? 'h-9 min-w-[2.5rem] w-full' : 'h-14 min-w-[3.5rem] w-full'} flex items-center justify-center overflow-hidden rounded-xl bg-white/50 dark:bg-white/5 shadow-sm`}>
                <span
                    key={value}
                    className={`${isSmall ? 'text-xl' : 'text-3xl'} font-bold font-display tabular-nums transition-all duration-300 ${isFlipping ? 'animate-slide-up' : ''}`}
                    style={{ color: 'var(--eye-accent-soft, #8a9a5b)' }}
                >
                    {String(value).padStart(2, '0')}
                </span>
            </div>
            <span className={`${isSmall ? 'text-[9px] mt-0.5' : 'text-[11px] mt-1'} font-semibold text-sage/70 uppercase tracking-widest`}>{label}</span>
        </div>
    );
};
