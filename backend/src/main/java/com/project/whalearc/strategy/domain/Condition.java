package com.project.whalearc.strategy.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Condition {
    private String indicator;
    private Operator operator;
    private double value;
    private Logic logic;

    public enum Operator { GT, LT, EQ, GTE, LTE }
    public enum Logic { AND, OR }
}
